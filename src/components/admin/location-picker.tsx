'use client';

import { useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { wgs84ToGcj02, gcj02ToWgs84 } from '@/lib/coord-transform';

// 选点标记图标（蓝色圆点）
const PickerIcon = L.divIcon({
  className: 'location-picker-marker',
  html: `<div style="
    width: 24px; height: 24px;
    background: #3b82f6;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(59,130,246,0.5);
    position: relative;
  "><div style="
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid #3b82f6;
  "></div></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

interface LocationPickerProps {
  /** 当前 WGS-84 纬度 */
  latitude: string;
  /** 当前 WGS-84 经度 */
  longitude: string;
  /** 选中位置后的回调，参数为 WGS-84 坐标 */
  onPick: (lat: string, lng: string) => void;
}

/** 地图点击事件处理 */
function ClickHandler({ onPick }: { onPick: (lat: string, lng: string) => void }) {
  useMapEvents({
    click(e) {
      // 地图上点击的坐标是 GCJ-02（因为瓦片用的是高德），转回 WGS-84 存储
      const [wgsLat, wgsLng] = gcj02ToWgs84(e.latlng.lat, e.latlng.lng);
      onPick(wgsLat.toFixed(6), wgsLng.toFixed(6));
    },
  });
  return null;
}

/** 当外部坐标变化时，移动地图视角 */
function FlyToCenter({ latitude, longitude }: { latitude: string; longitude: string }) {
  const map = useMap();

  useEffect(() => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      // WGS-84 → GCJ-02 以匹配高德瓦片
      const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng);
      map.flyTo([gcjLat, gcjLng], 14, { duration: 0.8 });
    }
  }, [latitude, longitude, map]);

  return null;
}

export default function LocationPicker({ latitude, longitude, onPick }: LocationPickerProps) {
  // 解析当前坐标，转为 GCJ-02 用于地图显示
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const hasValidCoords = !isNaN(lat) && !isNaN(lng);

  // 默认中心点（中国中心）和标记位置
  const [centerLat, centerLng] = hasValidCoords ? wgs84ToGcj02(lat, lng) : [35.86, 104.19];
  const markerPosition: [number, number] | null = hasValidCoords ? [centerLat, centerLng] : null;

  const handlePick = useCallback((newLat: string, newLng: string) => {
    onPick(newLat, newLng);
  }, [onPick]);

  return (
    <div className="space-y-2">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={hasValidCoords ? 14 : 4}
        className="w-full rounded-lg border border-stone-200"
        style={{ height: '280px' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.amap.com/">高德地图</a>'
          url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
          subdomains={['1', '2', '3', '4']}
        />
        <ClickHandler onPick={handlePick} />
        <FlyToCenter latitude={latitude} longitude={longitude} />
        {markerPosition && (
          <Marker position={markerPosition} icon={PickerIcon} />
        )}
      </MapContainer>
      <div className="flex items-center justify-between">
        <p className="text-xs text-stone-400">
          点击地图选择拍摄地点，坐标自动填入上方输入框
        </p>
        {hasValidCoords && (
          <span className="text-xs text-emerald-600 font-mono">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
