import React, { useState, useEffect } from "react";
import io from "socket.io-client";
// const socket = io();
// const socket = io("http://localhost:3000/api/upload");

const Home = () => {
  const [file, setFile] = useState(null);

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
    <div>
      <h1>File Upload</h1>
      <form onSubmit={handleSubmit}>
        <input type="file" onChange={handleFileChange} />
        <button type="submit">Upload</button>
      </form>
    </div>
  );
};

export default Home;
