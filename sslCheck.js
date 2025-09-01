import sslChecker from "ssl-checker";

export async function checkSSL(url) {
  try {
    const hostname = new URL(url).hostname;
    const cert = await sslChecker(hostname, { method: "GET" });

    let riskPoints = 0;

    const now = new Date();
    const validFrom = new Date(cert.validFrom);
    const validTo = new Date(cert.validTo);

    if (now < validFrom || now > validTo) riskPoints += 20;
    if (!cert.valid) riskPoints += 20; // domain mismatch
    if (cert.issuer === "Self-signed") riskPoints += 20;

    const isEV = cert.issuerOrganization ? true : false;
    if (isEV) riskPoints -= 10;

    return { cert, riskPoints };
  } catch (err) {
    console.error("SSL check error:", err);
    return { cert: null, riskPoints: 20 };
  }
}
