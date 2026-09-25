import sharp from "sharp";

// A heavily blurred, low-res preview of paid content. Built server-side so
// the real image never reaches anyone who hasn't unlocked it -- a CSS blur
// on the real file can be removed in dev tools.
export async function makeTeaser(image: Buffer): Promise<Buffer> {
  const tiny = await sharp(image).resize(40, 40, { fit: "cover" }).blur(1.5).toBuffer();
  return sharp(tiny).resize(480, 480, { kernel: "cubic" }).blur(8).jpeg({ quality: 70 }).toBuffer();
}

// Square, small profile picture for creator avatars.
export async function makeAvatar(image: Buffer): Promise<Buffer> {
  return sharp(image).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
}
