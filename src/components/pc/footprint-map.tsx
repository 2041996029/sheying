'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { wgs84ToGcj02 } from '@/lib/coord-transform';

// Fix leaflet default marker icon for webpack/next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

/** 无封面时的兜底图标 */
const FallbackIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 40px; height: 40px;
    background: linear-gradient(135deg, #b45309, #d97706);
    border: 3px solid rgba(255,255,255,0.95);
    border-radius: 8px;
    box-shadow: 0 3px 12px rgba(180,83,9,0.35);
    display: flex; align-items: center; justify-content: center;
  "><span style="font-size: 18px; filter: brightness(1.2);">📷</span></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

/**
 * 根据封面图生成自定义 divIcon
 * 缩略图 + 底部小三角指向上方坐标点
 */
function createCoverIcon(coverUrl: string | null): L.DivIcon {
  if (!coverUrl) return FallbackIcon;

  const size = 56; // 缩略图尺寸
  const pointerH = 10; // 底部三角高度

  return L.divIcon({
    className: 'cover-marker',
    html: `
      <div style="
        position: relative;
        width: ${size}px;
      ">
        <div style="
          width: ${size}px; height: ${size}px;
          border: 3px solid rgba(255,255,255,0.95);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        ">
          <img src="${coverUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
            style="width:100%; height:100%; object-fit:cover; display:block;"
            loading="lazy"
          />
        </div>
        <div style="
          width: 0; height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: ${pointerH}px solid rgba(255,255,255,0.95);
          margin: 0 auto;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.15));
        "></div>
      </div>
    `,
    iconSize: [size, size + pointerH],
    iconAnchor: [size / 2, size + pointerH],
    popupAnchor: [0, -(size + pointerH + 4)],
  });
}

interface FootprintItem {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  latitude: number;
  longitude: number;
  location: string | null;
  takenAt: string | null;
  category: { id: string; name: string } | null;
}

interface FootprintMapProps {
  footprints: FootprintItem[];
}

/** 从 location 字段提取省份 */
function extractProvince(location: string | null): string {
  if (!location) return '__unknown__';
  return location.split('·')[0]?.trim() || '__unknown__';
}

/** 从 location 字段提取省+市 */
function extractRegion(location: string | null): string {
  if (!location) return '__unknown__';
  return location.split('·').slice(0, 2).join('·').trim() || '__unknown__';
}

/** 计算地图初始视图：优先定位到发布作品最多的区域，缩放11级 */
function computeInitialView(footprints: FootprintItem[]): { center: [number, number]; zoom: number } {
  if (footprints.length === 0) {
    return { center: [35.86, 104.19], zoom: 4 };
  }

  const provinceCount = new Map<string, number>();
  const provinceCoords = new Map<string, { lat: number; lng: number }[]>();

  for (const fp of footprints) {
    const province = extractProvince(fp.location);
    provinceCount.set(province, (provinceCount.get(province) || 0) + 1);

    const [gcjLat, gcjLng] = wgs84ToGcj02(fp.latitude, fp.longitude);
    if (!provinceCoords.has(province)) {
      provinceCoords.set(province, []);
    }
    provinceCoords.get(province)!.push({ lat: gcjLat, lng: gcjLng });
  }

  let topProvince = '';
  let topCount = 0;
  for (const [province, count] of provinceCount) {
    if (count > topCount) {
      topCount = count;
      topProvince = province;
    }
  }

  if (topProvince !== '__unknown__' && topCount > 1) {
    const cityCount = new Map<string, number>();
    const cityCoords = new Map<string, { lat: number; lng: number }[]>();

    for (const fp of footprints) {
      const province = extractProvince(fp.location);
      if (province !== topProvince) continue;

      const region = extractRegion(fp.location);
      cityCount.set(region, (cityCount.get(region) || 0) + 1);

      const [gcjLat, gcjLng] = wgs84ToGcj02(fp.latitude, fp.longitude);
      if (!cityCoords.has(region)) {
        cityCoords.set(region, []);
      }
      cityCoords.get(region)!.push({ lat: gcjLat, lng: gcjLng });
    }

    let topCity = '';
    let topCityCount = 0;
    for (const [city, count] of cityCount) {
      if (count > topCityCount) {
        topCityCount = count;
        topCity = city;
      }
    }

    const coords = cityCoords.get(topCity) || provinceCoords.get(topProvince) || [];
    if (coords.length > 0) {
      const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
      const avgLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
      return { center: [avgLat, avgLng], zoom: 11 };
    }
  }

  const coords = provinceCoords.get(topProvince) || [];
  if (coords.length > 0) {
    const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const avgLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
    return { center: [avgLat, avgLng], zoom: 11 };
  }

  return { center: [35.86, 104.19], zoom: 4 };
}

function SetInitialView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}

export default function FootprintMap({ footprints }: FootprintMapProps) {
  const amapTileUrl = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';

  const initialView = useMemo(() => computeInitialView(footprints), [footprints]);

  // 为每个足迹预生成图标（避免渲染时重复创建）
  const markerIcons = useMemo(() => {
    return footprints.map((fp) => createCoverIcon(fp.coverUrl));
  }, [footprints]);

  return (
    <MapContainer
      center={initialView.center}
      zoom={initialView.zoom}
      className="w-full h-full footprint-map"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.amap.com/">高德地图</a>'
        url={amapTileUrl}
        subdomains={['1', '2', '3', '4']}
      />
      {footprints.map((fp, index) => {
        const [gcjLat, gcjLng] = wgs84ToGcj02(fp.latitude, fp.longitude);
        return (
          <Marker key={fp.id} position={[gcjLat, gcjLng]} icon={markerIcons[index]}>
            <Popup>
              <a
                href={`/work/${fp.id}`}
                className="block min-w-[200px] p-1 cursor-pointer group/popup"
              >
                {fp.coverUrl && (
                  <img
                    src={fp.coverUrl}
                    alt={fp.title}
                    className="w-full h-28 object-cover rounded-md mb-2 group-hover/popup:brightness-95 transition-all"
                  />
                )}
                <div className="font-semibold text-sm group-hover/popup:text-primary transition-colors">{fp.title}</div>
                {fp.location && (
                  <div className="text-xs text-gray-400 mt-0.5">{fp.location}</div>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  {fp.category && (
                    <span className="inline-block text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                      {fp.category.name}
                    </span>
                  )}
                  {fp.takenAt && (
                    <span className="text-xs text-gray-400">
                      {new Date(fp.takenAt).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-center text-muted-foreground mt-2 group-hover/popup:text-primary transition-colors">
                  点击查看详情 →
                </div>
              </a>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
