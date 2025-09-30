#!/usr/bin/env node
/**
 * @license
 * Copyright 2022-2025 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * このサンプルは、温度または湿度センサーとして動作するシンプルな Matter デバイスの実装例です。
 * CLI スクリプトとして利用でき、独自のデバイスノードを作る際の出発点になります。
 * CommonJS 互換の構成で、トップレベル await は使用していません。
 */

import { Endpoint, Environment, Logger, ServerNode, StorageService, Time } from "@matter/main";
import { HumiditySensorDevice } from "@matter/main/devices/humidity-sensor";
import { TemperatureSensorDevice } from "@matter/main/devices/temperature-sensor";
import { DeviceTypeId, VendorId } from "@matter/main/types";
import { execSync } from "node:child_process";

const logger = Logger.get("SensorDeviceNode");

async function main() {
    /** 設定値を初期化 */
    const {
        isTemperature,
        interval,
        deviceName,
        vendorName,
        passcode,
        discriminator,
        vendorId,
        productName,
        productId,
        port,
        uniqueId,
    } = await getConfiguration();

    /**
     * ルートエンドポイントや関連データ、設定を保持する Matter ServerNode を生成
     */
    const server = await ServerNode.create({
        // 必須: ノード状態を保持するため、一意な ID を割り当てる
        id: uniqueId,

        // ポートなどネットワーク関連の設定
        // ホスト上で単一デバイスを動かす場合は任意。既定値は 5540
        network: {
            port,
        },

        // コミッショニング関連の設定
        // 開発・テスト中は省略可能
        commissioning: {
            passcode,
            discriminator,
        },

        // ノード告知の設定
        // 省略すると開発用の既定値が使われる
        productDescription: {
            name: deviceName,
            deviceType: DeviceTypeId(
                isTemperature ? TemperatureSensorDevice.deviceType : HumiditySensorDevice.deviceType,
            ),
        },

        // ルートエンドポイントにある BasicInformation クラスタの初期値
        // 省略した場合は開発向けの既定値が利用される
        basicInformation: {
            vendorName,
            vendorId: VendorId(vendorId),
            nodeLabel: productName,
            productName,
            productLabel: productName,
            productId,
            serialNumber: `matterjs-${uniqueId}`,
            uniqueId,
        },
    });

    /**
     * Matter のノードはエンドポイントの集合で構成される。この処理では単一エンドポイントを生成し、ノードに追加する。
     * type パラメータに応じて温度センサーまたは湿度センサーのデバイス定義を使い分け、再起動時に復元できるよう
     * ストレージに保持するための一意な ID も割り当てている。
     * コマンド処理は matter.js 標準の実装をそのまま利用しており、カスタマイズしたい場合は DeviceNodeFull の例を参照。
     */
    let endpoint: Endpoint<TemperatureSensorDevice | HumiditySensorDevice>;
    if (isTemperature) {
        endpoint = new Endpoint(TemperatureSensorDevice, {
            id: "tempsensor",
            temperatureMeasurement: {
                // 測定値を最新の値で初期化するためのフィールド。
                // 値が不明で取得もできない場合は、クラスタが許可するなら "null" を設定する。
                measuredValue: getIntValueFromCommandOrRandom("value"),
            },
        });
    } else {
        endpoint = new Endpoint(HumiditySensorDevice, {
            id: "humsensor",
            relativeHumidityMeasurement: {
                // 測定値を最新の値で初期化するためのフィールド。
                // 値が不明で取得もできない場合は、クラスタが許可するなら "null" を設定する。
                measuredValue: getIntValueFromCommandOrRandom("value", false),
            },
        });
    }

    await server.add(endpoint);

    /**
     * エンドポイント構成をログに出して設定が妥当か確認する
     */
    logger.info(server);

    const updateInterval = setInterval(() => {
        let setter: Promise<void>;
        if (isTemperature) {
            setter = endpoint.set({
                temperatureMeasurement: {
                    measuredValue: getIntValueFromCommandOrRandom("value"),
                },
            });
        } else {
            setter = endpoint.set({
                relativeHumidityMeasurement: {
                    measuredValue: getIntValueFromCommandOrRandom("value", false),
                },
            });
        }
        setter.catch(error => console.error("Error updating measured value:", error));
    }, interval * 1000);

    // ノードがオフラインになったら更新用タイマーを破棄
    server.lifecycle.offline.on(() => clearTimeout(updateInterval));

    /**
     * ノードを起動してネットワークにアナウンスするため run を呼び出す。run はノードがオフラインになった時点で解決する。
     * 追加の起動制御が必要な場合はフル機能版のサンプルを参照。QR コードは自動的に表示される。
     */
    await server.run();
}

main().catch(error => console.error(error));

/*********************************************************************************************************
 * 補助メソッド
 *********************************************************************************************************/

/** 環境変数で指定されたシェルコマンドを実行し、結果を数値として利用できる形に整える。 */

function getIntValueFromCommandOrRandom(scriptParamName: string, allowNegativeValues = true) {
    const script = Environment.default.vars.string(scriptParamName);
    if (script === undefined) {
        if (!allowNegativeValues) return Math.round(Math.random() * 100);
        return (Math.round(Math.random() * 100) - 50) * 100;
    }
    let result = execSync(script).toString().trim();
    if ((result.startsWith("'") && result.endsWith("'")) || (result.startsWith('"') && result.endsWith('"')))
        result = result.slice(1, -1);
    console.log(`Command result: ${result}`);
    let value = Math.round(parseFloat(result));
    if (!allowNegativeValues && value < 0) value = 0;
    return value;
}

async function getConfiguration() {
    /**
     * 必要なデータを集める。
     *
     * CLI・環境変数・ストレージなど、あなたの環境に適した場所から値を取得する処理に置き換えてよい。
     *
     * 注意: このサンプルでは利便性のため matter.js のプロセスストレージにデバイス設定を保存している。
     * 同じ方法を採用する場合は、Matter-Server が利用するストレージ領域と重複しないよう十分注意すること。
     */
    const environment = Environment.default;

    const storageService = environment.get(StorageService);
    console.log(`Storage location: ${storageService.location} (Directory)`);
    console.log(
        'Use the parameter "--storage-path=NAME-OR-PATH" to specify a different storage location in this directory, use --storage-clear to start with an empty storage.',
    );
    const deviceStorage = (await storageService.open("device")).createContext("data");

    const isTemperature = await deviceStorage.get("isTemperature", environment.vars.get("type") !== "humidity");
    if (await deviceStorage.has("isTemperature")) {
        console.log(
            `Device type ${isTemperature ? "temperature" : "humidity"} found in storage. --type parameter is ignored.`,
        );
    }
    let interval = environment.vars.number("interval") ?? (await deviceStorage.get("interval", 60));
    if (interval < 1) {
        console.log(`Invalid Interval ${interval}, set to 60s`);
        interval = 60;
    }

    const deviceName = "Matter test device";
    const vendorName = "matter-node.js";
    const passcode = environment.vars.number("passcode") ?? (await deviceStorage.get("passcode", 20202021));
    const discriminator = environment.vars.number("discriminator") ?? (await deviceStorage.get("discriminator", 3840));
    // プロダクト名／ID とベンダー ID はデバイス証明書の内容と一致させること
    const vendorId = environment.vars.number("vendorid") ?? (await deviceStorage.get("vendorid", 0xfff1));
    const productName = `node-matter OnOff ${isTemperature ? "Temperature" : "Humidity"}`;
    const productId = environment.vars.number("productid") ?? (await deviceStorage.get("productid", 0x8000));

    const port = environment.vars.number("port") ?? 5540;

    const uniqueId =
        environment.vars.string("uniqueid") ?? (await deviceStorage.get("uniqueid", Time.nowMs.toString()));

    // 再起動後も利用できるよう基本情報をストレージに保存
    await deviceStorage.set({
        passcode,
        discriminator,
        vendorid: vendorId,
        productid: productId,
        interval,
        isTemperature,
        uniqueid: uniqueId,
    });

    return {
        isTemperature,
        interval,
        deviceName,
        vendorName,
        passcode,
        discriminator,
        vendorId,
        productName,
        productId,
        port,
        uniqueId,
    };
}
