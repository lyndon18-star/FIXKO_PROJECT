import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(root, "..", "public", "logo", "fixko-logo.svg");
const outPath = path.join(root, "..", "public", "logo", "fixko-logo.png");

const svg = readFileSync(svgPath, "utf8");
await sharp(Buffer.from(svg))
  .resize(1024, 1024)
  .png()
  .toFile(outPath)
  .then((info) => console.log("written:", info.width + "x" + info.height, info.size + " bytes"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
