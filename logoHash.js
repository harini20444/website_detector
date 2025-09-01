import imghash from "imghash";

export async function compareLogos(suspiciousImage, officialImage) {
  try {
    const hash1 = await imghash.hash(suspiciousImage, 16); // 16-bit hash
    const hash2 = await imghash.hash(officialImage, 16);

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    const similarity = ((hash1.length - distance) / hash1.length) * 100;
    return similarity;
  } catch (err) {
    console.error("Logo hash error:", err);
    return 0;
  }
}
