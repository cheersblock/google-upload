var request = require("request");
const path = require("path");
const AdmZip = require("adm-zip");
const fs = require("fs");
const multer = require("multer");
const catchAsync = require("./../utils/catchAsync");
const dotenv = require("dotenv").config();
const fetch = require("node-fetch");
const { default: axios } = require("axios");

const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

var numberOfFiles = 0;
var filesDoneUpl = 0;
var mainDirectory = "";
var totalSize = 0;

// let uploadFile = upload.single("zipFile");
exports.uploadZipFile = upload.single("zipFile");

exports.uploadBunnyZip = catchAsync(async (req, res, next) => {
  try {
    console.log(process.env.API_KEY);
    console.log("req.file", req.file);
    console.log("Size:", req.file.size);
    //   console.log("req.body", req.body);
    //   const socketio = res.socket.server.io;
    const socketio = "res.socket.server.io";

    totalSize = req.file.size;

    console.log("req.file.filename", req.file.originalname);

    // Unzip File
    const unzipDestination = path.join(
      "./unzipped",
      req.file.originalname.replace(".zip", "")
    );
    let filename = req.file.originalname.replace(".zip", "");

    const zip = new AdmZip(req.file.buffer);
    zip.extractAllTo(unzipDestination, true);
    const entries = zip.getEntries();
    mainDirectory = unzipDestination;
    // numberOfFiles = entries.length;
    // filesDoneUpl = entries.length;
    // console.log("Entries of files", numberOfFiles);

    entries.forEach((entry) => {
      if (!entry.isDirectory) {
        ++numberOfFiles;
        ++filesDoneUpl;
      }
    });

    await uploadAxios(filename, unzipDestination);

    console.log("DONEEEE");

    res.status(200).send({
      //result: result,
      // folderId: fileId,
      message: "Success",
    });
  } catch (e) {
    console.log("ERROR:", e);
  }
});

async function uploadAxios(fileDirectoryName, folderPath) {
  console.log("Directory Name", fileDirectoryName);

  const folder = await fs.promises.opendir(folderPath);
  for await (const dirent of folder) {
    if (dirent.isFile()) {
      axios
        .put(
          `https://sg.storage.bunnycdn.com/katana-upload/${fileDirectoryName}/${dirent.name}`,
          fs.createReadStream(path.join(folderPath, dirent.name)),
          {
            headers: {
              "Content-Type": "application/json",
              AccessKey: "718f7621-e4c8-41f5-b89120e117d1-c896-451f",
            },
          }
        )
        .then(async (res) => {
          console.log(res);
          //   await fs.promises.rm(path.join(folderPath, dirent.name));
        })
        .catch((error) => {
          console.log(error);
        });
    } else {
      await uploadAxios(
        path.join(fileDirectoryName, dirent.name),
        path.join(folderPath, dirent.name)
      );
    }
  }
}

function startUploading() {
  fs.readdir(process.argv[2], (err, files) => {
    (async () => {
      files.forEach((file) => {
        setTimeout(function intervalFunc() {
          uploadItem(process.argv[2] + "/" + file);
        }, slowdown);
        slowdown = slowdown + 300;
      });
    })();
  });
}

async function uploadItem(fileDirectoryName, folderPath) {
  const folder = await fs.promises.opendir(folderPath);
  for await (const dirent of folder) {
    if (dirent.isFile()) {
      console.log("uploading " + dirent.name);
      request(
        {
          method: "PUT",
          preambleCRLF: true,
          postambleCRLF: true,
          uri: `https://sg.storage.bunnycdn.com/katana-upload/${fileDirectoryName}`,
          headers: {
            "Content-Type": "application/json",
            AccessKey: "718f7621-e4c8-41f5-b89120e117d1-c896-451f",
          },
          multipart: [
            { body: fs.createReadStream(path.join(folderPath, dirent.name)) },
          ],
        },
        function (error, response, body) {
          console.log("body:", body);
          if (error) {
            return console.error("upload failed:", error);
          }
        }
      );
    } else {
      await uploadItem(dirent.name, path.join(folderPath, dirent.name));
    }
  }
}

exports.download = catchAsync(async (req, res, next) => {
  console.log("Downloading...");
  const url = "https://sg.storage.bunnycdn.com/katana-upload/1.jpeg";
  const options = {
    method: "GET",
    headers: {
      accept: "*/*",
      AccessKey: "718f7621-e4c8-41f5-b89120e117d1-c896-451f",
    },
  };

  const response = await axios
    .get(url, options)
    .then((response) => {
      console.log(response.data);
      const writer = fs.createWriteStream("./downloads/");

      // Pipe the response data to the writer to save the file
      writer.write(response.data);
      writer.end();
    })
    .catch((error) => {
      console.error("Error:", error);
    });

  // Specify the path where you want to save the downloaded file
  const filePath = path.join("./downloads", "1.jpeg");

  // Create a write stream to save the file
  const writer = fs.createWriteStream("./downloads/");

  // Pipe the response data to the writer to save the file
  response.data.pipe(writer);

  // Wait for the writer to finish saving the file
  await new Promise((resolve) => {
    writer.on("finish", resolve);
  });

  console.log("Downloaded and saved:", filePath);

  res.status(200).send({
    message: "Success",
  });
});
