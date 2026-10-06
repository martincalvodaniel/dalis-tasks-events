import sharp from "sharp"

const source = "public/dalis-icon.svg"
for (const [size, file] of [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
] as const) {
  await sharp(source).resize(size, size).png().toFile(`public/${file}`)
}
