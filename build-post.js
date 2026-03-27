// Post-build script: verifies critical output files exist
import fs from "fs";
import path from "path";

const dist = path.resolve("dist");
const required = ["index.html", "sw.js"];
let allGood = true;

for (const file of required) {
  const fullPath = path.join(dist, file);
  if (fs.existsSync(fullPath)) {
    const size = (fs.statSync(fullPath).size / 1024).toFixed(1);
    console.log(`✅ ${file} (${size} KB)`);
  } else {
    console.error(`❌ MISSING: ${file}`);
    allGood = false;
  }
}

if (!allGood) process.exit(1);
console.log("✅ Build verified successfully");
