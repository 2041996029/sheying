/**
 * WGS-84 → GCJ-02 坐标转换
 * GPS 原始坐标（WGS-84）在国内地图（高德、腾讯等）上会有 100~600 米偏移，
 * 需要转换为 GCJ-02（火星坐标系）才能与国内地图瓦片对齐。
 */

const PI = Math.PI;
const A = 6378245.0; // 长半轴
const EE = 0.00669342162296594323; // 扁率

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

/**
 * WGS-84 坐标转 GCJ-02（火星坐标）
 * @param wgsLat WGS-84 纬度
 * @param wgsLng WGS-84 经度
 * @returns [gcjLat, gcjLng]
 */
export function wgs84ToGcj02(wgsLat: number, wgsLng: number): [number, number] {
  if (outOfChina(wgsLat, wgsLng)) {
    return [wgsLat, wgsLng];
  }
  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radLat = (wgsLat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return [wgsLat + dLat, wgsLng + dLng];
}

/**
 * GCJ-02（火星坐标）转 WGS-84 坐标
 * 在高德地图上点击获取的坐标是 GCJ-02，需要转回 WGS-84 存储，
 * 以便与照片 EXIF 中的 GPS 原始坐标保持一致。
 * @param gcjLat GCJ-02 纬度
 * @param gcjLng GCJ-02 经度
 * @returns [wgsLat, wgsLng]
 */
export function gcj02ToWgs84(gcjLat: number, gcjLng: number): [number, number] {
  if (outOfChina(gcjLat, gcjLng)) {
    return [gcjLat, gcjLng];
  }
  let dLat = transformLat(gcjLng - 105.0, gcjLat - 35.0);
  let dLng = transformLng(gcjLng - 105.0, gcjLat - 35.0);
  const radLat = (gcjLat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return [gcjLat - dLat, gcjLng - dLng];
}
