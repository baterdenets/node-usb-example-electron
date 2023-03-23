// Modules to control application life and create native browser window
const { app, BrowserWindow } = require("electron");
const path = require("path");
const usb = require("usb");

let windows = [];

const webusb = new usb.WebUSB({
  allowAllDevices: true,
});

const showDevices = async () => {
  const devices = await webusb.getDevices();
  const text = devices.map((d) => {
    return `${d.vendorId}\t${d.productId}\t${
      d.serialNumber || "<no serial>"
    }\t${d.productName}`;
  });
  text.unshift("VID\tPID\tSerial\n-------------------------------------");
  const cardReader = devices.find(
    (v) => v.productName === "USB3.0 Card Reader"
  );
  if (!!cardReader) {
    const device = usb.findByIds(cardReader.vendorId, cardReader.productId);

    device.open((error) => {
      if (error) {
        console.error("device.open", error);
        return;
      }

      // Select the first interface of the device
      const iface = device.interfaces[0];

      // Claim the interface so we can communicate with it
      iface.claim();

      // Get the input and output endpoints of the interface
      const inEndpoint = iface.endpoints[0];
      const outEndpoint = iface.endpoints[1];

      // Send a command to the card reader
      const command = Buffer.from([0x00, 0xb0, 0x00, 0x00, 0x20]); // Replace with your command
      outEndpoint.transfer(command, (error) => {
        if (error) {
          console.error(error);
          return;
        }

        // Read the response from the card reader
        const responseLength = 64; // Replace with the expected length of the response
        inEndpoint.transfer(responseLength, (error, data) => {
          if (error) {
            console.error(error);
            return;
          }

          // Process the data read from the card reader
          console.log("data", data);
        });
      });

      // Release the interface and close the device when done
      iface.release(() => {
        device.close();
      });
    });
  }
  windows.forEach((win) => {
    if (win) {
      win.webContents.send("devices", text.join("\n"));
    }
  });
};

const createWindow = () => {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  win.loadFile("index.html");

  // Open the DevTools.
  // win.webContents.openDevTools()

  windows.push(win);
  showDevices();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  webusb.addEventListener("connect", showDevices);
  webusb.addEventListener("disconnect", showDevices);

  createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  webusb.removeEventListener("connect", showDevices);
  webusb.removeEventListener("disconnect", showDevices);

  app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
