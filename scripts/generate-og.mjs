// public/og-image.svg → public/og-image.png 자동 변환
// 빌드 전 자동 실행 (package.json prebuild)
// 카카오톡/페이스북/트위터 등은 OG 이미지로 SVG를 지원하지 않으므로 PNG 필요
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

const SVG_PATH = path.resolve("public/og-image.svg");
const PNG_PATH = path.resolve("public/og-image.png");

if (!fs.existsSync(SVG_PATH)) {
  console.warn("⚠️  public/og-image.svg 없음 — OG 이미지 생성 건너뜀");
  process.exit(0);
}

const svg = fs.readFileSync(SVG_PATH);
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  background: "#0a150d",
});
const pngBuffer = resvg.render().asPng();
fs.writeFileSync(PNG_PATH, pngBuffer);

const sizeKB = (pngBuffer.length / 1024).toFixed(1);
console.log(`✅ public/og-image.png 생성 (${sizeKB} KB)`);
