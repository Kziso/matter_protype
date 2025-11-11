# Home Assistant OS（Raspberry Pi）構築と Matter.js デバイス登録手順書

最終更新: 2025-10-25 / 対象: 実験・演習用途（Wi-FiベースのMatter.jsデバイス）

---

## 0. 全体像

- **目的**: Raspberry Pi に **Home Assistant OS** を導入し、Wi-Fi接続の **Matter.js デバイス**（Node.js で動作）を Home Assistant に **ペアリング登録**して制御できるようにする。
- **前提**: Thread は使用しない（Matter over Wi-Fi / Ethernet）。  
- **構成図（論理）**:

```
[Home Assistant OS on Raspberry Pi]  ←→  [LAN/Wi-Fi(IPv6, mDNS有効)]
      └ Matter Controller/Server                │
                                                └─ [Node.js + Matter.js Device (Wi-Fi)]
```

---

## 1. ハードウェア準備

### 1.1 必要物
- Raspberry Pi 4B/5（RAM 4GB以上推奨）
- 電源アダプタ 5V/3A 以上（純正推奨）
- microSDカード 32–128GB（Class 10 / A1 以上推奨）
- 有線LAN（初期セットアップ安定のため推奨）または Wi-Fi
- （任意）初回のみ HDMIモニタ/USBキーボード（SSHで不要）

### 1.2 ネットワーク要件
- Home Assistant OS と Matter.js デバイスが **同一L2ネットワーク/サブネット**に存在
- **mDNS/マルチキャスト**がブロックされていない
- ルータ/スイッチの **IGMPスヌーピング**設定がmDNSを阻害しないこと
- IPv6は**リンクローカル**で十分（ルータのIPv6インターネット接続までは不要）

---

## 2. OSインストール（Home Assistant OS）

### 2.1 イメージ書き込み
1. 公式ページから Raspberry Pi 用の Home Assistant OS イメージを取得  
   → `https://www.home-assistant.io/installation/raspberrypi`
2. **Raspberry Pi Imager** または **balenaEtcher** を使い、microSD に書き込み。
3. （Wi-Fiで起動する場合のみ）SD カードの **`CONFIG/network/my-network`** を作成/編集してSSID/PASSWORDを設定。

#### 2.1.1 `my-network` 例（WPA2, DHCP）
```
[connection]
id=my-network
uuid=12345678-1234-5678-9abc-1234567890ab
type=802-11-wireless

[802-11-wireless]
mode=infrastructure
ssid=YourSSID

[802-11-wireless-security]
auth-alg=open
key-mgmt=wpa-psk
psk=YourWifiPassword

[ipv4]
method=auto

[ipv6]
addr-gen-mode=stable-privacy
method=auto
```

> ※有線LANで起動できる場合は、初期は有線を推奨（安定・簡便）。

### 2.2 初回起動
1. microSD を挿入し、電源ON。
2. 起動～セットアップには **5–10分** 程度。
3. 別端末から以下にアクセス：
   - `http://homeassistant.local:8123`
   - または Pi のIPで `http://<RaspberryPiのIP>:8123`

### 2.3 初期セットアップウィザード
- 管理者アカウント作成
- タイムゾーン: **Asia/Tokyo**
- 単位系/位置情報など

---

## 3. Home Assistant（HA）側のMatter準備

### 3.1 Matter統合の有効化確認
1. Home Assistant UI → **設定** → **デバイスとサービス**
2. 右下 **「＋ 追加」** → **「Matter」** を検索し追加
3. **Add-ons**（アドオン）で **Matter Server** が起動していることを確認

---

## 4. Matter.js デバイスの準備（Node.js側）

> 開発用PC、または別のRaspberry Pi で動作させます。**Home Assistantと同一ネットワーク**に置いてください。

### 4.1 Node.js 環境
```bash
sudo apt update
sudo apt install -y nodejs npm
npm --version
node --version
```

### 4.2 依存パッケージ
```bash
npm install @matter/main
```

### 4.3 サンプルデバイス（On/Off Light）

**最小版（ログ出力のみ）**
```js
import { ServerNode } from '@matter/main';
import { OnOffLightDevice } from '@matter/main/devices/on-off-light';

const node = await ServerNode.create();
const light = await node.add(OnOffLightDevice);

light.events.onOff.onOff$Changed.on((status) => {
  console.log(`[Matter.js] Light status changed: ${status ? 'ON' : 'OFF'}`);
});

await node.start();
console.log(`[Matter.js] Commissioning code: ${node.commissioningCode}`);
```

### 4.4 起動
```bash
node light_device.js
```
コンソールに **Commissioning code**（例: `MT:123456789ABCDEF`）が表示されます。

---

## 5. Home Assistant でのデバイス登録

### 5.1 手順
1. Home Assistant UI → **設定** → **デバイスとサービス**
2. **Matter** 統合 → **デバイスを追加**
3. **セットアップコードを入力**
4. Matter.js 側で表示された **Commissioning code** を入力
5. 数十秒で登録完了。**デバイス一覧**に「On/Off Light」等が表示される

### 5.2 動作確認
- HA のダッシュボードからスイッチを **ON**  
  → Node.js 側で `Light status changed: ON` ログ出力
- **OFF** でも同様

---

## 6. トラブルシューティング

| 症状 | 確認ポイント |
|---|---|
| デバイスが見つからない | 同一サブネット/mDNS通信許可 |
| セットアップコード入力後に失敗 | Node.js 側デバイスが起動中か確認 |
| 一度つながるが切れる | Wi-Fi 安定性・電源容量確認 |
| IPv6関連で不安定 | ルータのリンクローカルIPv6動作確認 |
| GPIO動作しない | `gpioinfo` でチップ/ライン確認、root権限必要 |

---

## 7. チェックリスト

- [ ] HA OS 導入・アクセス確認
- [ ] Matter統合追加済み
- [ ] Node.js + Matter.js デバイス起動確認
- [ ] セットアップコード登録成功
- [ ] ON/OFF 制御動作確認

---
