import { LineProgressBar } from "@frogress/line";
import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import styled from "styled-components";

const Home = () => {
  const [file, setFile] = useState(null);
  const [filesData, setFilesData] = useState(0);
  console.log("🚀 ~ file: _app.js:8 ~ Home ~ filesData:", filesData);
  function convertValueToZeroToOne(value) {
    return 100 - value;
  }
  const StyledFileInput = styled.input`
    width: 350px;
    max-width: 100%;
    color: #444;
    padding: 5px;
    background: #fff;
    border-radius: 10px;
    border: 1px solid #555;
    &::file-selector-button {
      margin-right: 20px;
      border: none;
      background: #084cdf;
      padding: 10px 20px;
      border-radius: 10px;
      color: #fff;
      cursor: pointer;
      transition: background 0.2s ease-in-out;
    }
    & ::file-selector-button:hover {
      background: #0d45a5;
    }
  `;

  const StyledUpload = styled.input`
    margin-left: 20px;
    border: none;
    background: #084cdf;
    padding: 10px 20px;
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    transition: background 0.2s ease-in-out;
  `;

  useEffect(() => {
    fetch("/api/socket").finally(() => {
      const socket = io();

      socket.on("connect", () => {
        console.log("connect");
        socket.emit("hello");
      });

      socket.on("hello", (data) => {
        console.log("hello", data);
      });

      socket.on("progress", (data) => {
        console.log("Progress made", data);
        const progress = Math.floor(
          (data.filesDoneUpl / data.numberOfFiles) * 100
        );
        const value = convertValueToZeroToOne(progress);
        setFilesData(value);
      });

      socket.on("disconnect", () => {
        console.log("disconnect");
      });
    });
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("zipFile", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        console.log("File uploaded successfully");
      } else {
        console.error("File upload failed");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        height: "60vh",
      }}
    >
      <h1>File Upload</h1>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            onChange={handleFileChange}
            style={{
              width: "350px",
              maxWidth: "100%",
              color: "#444",
              padding: "5px",
              background: "#fff",
              borderRadius: "10px",
              border: "1px solid #555",
              transition: "background 0.2s ease-in-out",
            }}
          />
          <button
            type="submit"
            style={{
              marginLeft: "20px",
              border: "none",
              background: "#084cdf",
              padding: "10px 20px",
              borderRadius: "10px",
              color: "#fff",
              cursor: "pointer",
              transition: "background 0.2s ease-in-out",
            }}
          >
            Submit
          </button>
        </form>
        <div
          style={{
            width: "100%",
            display: filesData ? "inherit" : "none",
            marginTop: "1em",
          }}
        >
          <LineProgressBar percent={filesData}  />
        </div>
      </div>
    </div>
  );
};

export default Home;
