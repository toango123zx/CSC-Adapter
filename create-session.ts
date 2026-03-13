// import { TelegramClient } from "telegram";
// import { StringSession } from "telegram/sessions";
// import input from "input";

// const apiId = 123456; // api_id
// const apiHash = "your_api_hash";

// const stringSession = new StringSession("");

// (async () => {
//   const client = new TelegramClient(stringSession, apiId, apiHash, {
//     connectionRetries: 5,
//   });

//   await client.start({
//     phoneNumber: async () => await input.text("Phone number: "),
//     password: async () => await input.text("2FA password (if any): "),
//     phoneCode: async () => await input.text("Code from Telegram: "),
//     onError: (err) => console.log(err),
//   });

//   console.log("✅ Logged in successfully");

//   const session = client.session.save();

//   console.log("SESSION STRING:");
//   console.log(session);

//   await client.disconnect();
// })();