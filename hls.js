const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

// Configure S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

// Helper: Upload file to S3
async function uploadFileToS3(localFilePath, s3Key, contentType) {
  const fileContent = fs.readFileSync(localFilePath);
  return s3
    .upload({
      Bucket: process.env.AWS_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
    })
    .promise();
}

// Endpoint: Upload video
app.post("/upload", upload.single("video"), (req, res) => {
  const inputPath = req.file.path;
  const outputDir = path.join(__dirname, "hls-output", req.file.filename);

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log("Converting to HLS...");

  ffmpeg(inputPath)
    .outputOptions([
      // 240p
      "-filter:v:0 scale=w=426:h=240",
      "-c:v:0 libx264 -b:v:0 400k",
      "-c:a aac -ar 48000 -b:a 96k",

      // 480p
      "-filter:v:1 scale=w=854:h=480",
      "-c:v:1 libx264 -b:v:1 800k",
      "-c:a aac -ar 48000 -b:a 128k",

      // 720p
      "-filter:v:2 scale=w=1280:h=720",
      "-c:v:2 libx264 -b:v:2 2800k",
      "-c:a aac -ar 48000 -b:a 128k",

      // 1080p
      "-filter:v:3 scale=w=1920:h=1080",
      "-c:v:3 libx264 -b:v:3 5000k",
      "-c:a aac -ar 48000 -b:a 192k",

      // HLS options
      "-f hls",
      "-hls_time 6",
      "-hls_playlist_type vod",
      "-master_pl_name master.m3u8",
      '-var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3"',
    ])
    .output(path.join(outputDir, "hls_%v/index.m3u8"))
    .on("end", async () => {
      console.log("✅ Multi-bitrate HLS conversion finished");

      try {
        // Upload all generated files to S3
        const files = [];
        const walk = (dir) => {
          fs.readdirSync(dir).forEach((file) => {
            const fullPath = path.join(dir, file);
            if (fs.lstatSync(fullPath).isDirectory()) {
              walk(fullPath);
            } else {
              files.push(fullPath);
            }
          });
        };
        walk(outputDir);

        for (const filePath of files) {
          const relativeKey = path.relative(outputDir, filePath);
          const s3Key = `videos/${req.file.filename}/${relativeKey}`;

          const contentType = filePath.endsWith(".m3u8")
            ? "application/vnd.apple.mpegurl"
            : "video/MP2T";

          const uploaded = await uploadFileToS3(filePath, s3Key, contentType);
          console.log("Uploaded:", uploaded.Location);
        }

        res.json({
          message: "Video converted and uploaded",
          masterPlaylist: `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/videos/${req.file.filename}/master.m3u8`,
        });
      } catch (err) {
        console.error("Upload failed:", err);
        res.status(500).json({ error: "Upload failed" });
      }
    })
    .on("error", (err) => {
      console.error("FFmpeg error:", err);
      res.status(500).json({ error: "Conversion failed" });
    })
    .run();
});

app.listen(3000, () => console.log("🚀 Server started on port 3000"));
