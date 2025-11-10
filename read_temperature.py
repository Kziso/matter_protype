# read_temperature.py
# BME280センサーから温度データを読み取るスクリプト
# 必要なライブラリ: smbus2, bme280, RPi.bme280 をPIPでインストールしてください。

import smbus2
import bme280

# BME280センサーからデータを読み取る関数
def read_bme280_data():
	port = 1 
	address = 0x76
	bus = smbus2.SMBus(port)
	bme280.load_calibration_params(bus, address)
	data = bme280.sample(bus, address)
	
	return(data)

# メイン処理
# センサーから温度データを取得して表示
sensor_data = read_bme280_data()
# 温度データを100倍して表示 matterの仕様に合わせる 
temperature = sensor_data.temperature*100
print(temperature)
