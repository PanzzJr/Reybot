const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const logging = require("../lib/logging");
const { readFileSync, writeFileSync, unlinkSync } = require("fs");
const logger = require("pino");
const { join } = require("path");
const { tmpdir } = require("os");
const Crypto = require("crypto");
const ff = require("fluent-ffmpeg");
const webp = require("node-webpmux");
const pm2 = require("pm2");

const saveUsers = require("../lib/saveUsers");

module.exports = async ({ reybot, msg, isGroup, connectReybotWhatsapp }) => {
  const users = JSON.parse(
    readFileSync(join(__dirname, "../database/users.json"))
  );
  const contacts = JSON.parse(
    readFileSync(join(__dirname, "../database/contacts.json"))
  );

  if (isGroup) {
    /*///////
     * {*} Only fromMe {*}
     * //*/
    if (msg.key && msg.key.fromMe) {
      const userId = msg.key.participant;
      saveUsers({ userId });
      const groupId = msg.key.remoteJid;
      let metadataGroup;
      let groupParticipants;
      try {
        metadataGroup = await reybot.groupMetadata(groupId);
        groupParticipants = metadataGroup.participants.map((part) => part.id);
      } catch (err) {
        logging("error", "Error Get Metadata Group", err);
      }
      const filteredUsers = users.filter((user) => !contacts.includes(user));
      const dataUsers = groupParticipants
        ? groupParticipants.filter((part) => !filteredUsers.includes(part))
        : null;

      if (msg.message) {
        /*///////
         * {*} Messages Types Text / Conversation {*}
         * //*/
        const msgTxt = msg.message.extendedTextMessage
          ? msg.message.extendedTextMessage.text
          : msg.message.conversation;
        if (msg.message && msgTxt) {
          /*//////
           * {*} Get Info Groups {*}
           * //*/
          const regexInfo = new RegExp(/^\.Info/i);
          if (regexInfo.test(msgTxt)) {
            logging("info", `Get Message`, msgTxt);
            try {
              const templateText = `*Group Name: ${metadataGroup.subject}*\n*Group ID: ${metadataGroup.id}*\n*Group Owner: ${metadataGroup.owner}*`;
              await reybot.sendMessage(userId, { text: templateText });
            } catch (err) {
              logging("error", "Error get Info Group", err);
            }
          }
          /*//////
           * {*} End Get Info Groups {*}
           * //*/
          /*//////
           * {*} Start Broadcast Fitur {*}
           * //*/
          const regexBc = new RegExp(/^\.Bc/i);
          if (regexBc.test(msgTxt)) {
            logging("info", "Get Message", msgTxt);
            try {
              const broadcastTxt = msgTxt.replace(/^\.Bc\s*/i, "");
              let sent = 0;
              const loopBroadcast = setInterval(async () => {
                if (dataUsers.length === sent) {
                  logging(
                    "success",
                    `Broadcast Successfully`,
                    `Sent to ${sent} Users`
                  );
                  clearInterval(loopBroadcast);
                } else {
                  await reybot.sendMessage(dataUsers[sent], {
                    text: `${broadcastTxt}`,
                  });
                  sent++;
                  logging(
                    "error",
                    `Broadcast sent ${sent}`,
                    dataUsers[sent - 1]
                  );
                }
              }, 5000);
            } catch (err) {
              logging("error", "Failed to broadcast", err);
            }
          }
          /*//////
           * {*} End Broadcast {*}
           * //*/
          /*//////
           * {*} Clone Group {*}
           * //*/
          const cloneRegex = new RegExp(/^\.Clone/i);
          if (cloneRegex.test(msgTxt)) {
            logging("info", "Get Message", msgTxt);
            try {
              const nameGroup = msgTxt.replace(/^\.Clone\s*/i, "");
              const groupPict = readFileSync(
                join(__dirname, "../groupPict.jpeg")
              );
              const group = await reybot.groupCreate(`${nameGroup}`, [
                `${groupParticipants[0]}`,
              ]);
              await reybot.groupSettingUpdate(group.id, "locked");
              await reybot.sendMessage(group.id, {
                caption: `*Hallo Selamat datang semua di Group ${nameGroup}*`,
                image: groupPict,
                headerType: 4,
              });
              logging("success", "Successfully Create Group", nameGroup);
              logging("info", "Waiting for adding members", nameGroup);
              let index = 0;
              const loopAddUsers = setInterval(async () => {
                if (groupParticipants.length === index) {
                  logging(
                    "success",
                    "Cloning Successfully",
                    `Name: ${nameGroup} With ${index} Users`
                  );
                  clearInterval(loopAddUsers);
                } else {
                  await reybot.groupParticipantsUpdate(
                    group.id,
                    [`${groupParticipants[index]}`],
                    "add"
                  );
                  index++;
                  logging(
                    "error",
                    `Adding users in Group ${nameGroup}`,
                    groupParticipants[index - 1]
                  );
                }
              }, 5000);
            } catch (err) {
              logging("error", "Error Cloning group", err);
            }
          }
          /*///////
           * {*} End Clone Group {*}
           */ //*/
        }
        /*//////
         * {*} End Messages Types Text / Conversation {*}
         * //*/
        /*//////
         * {*} Messages Types Images {*}
         * //*/
        if (msg.message && msg.message.imageMessage) {
          /*//////
           * {*} Broadcast With Image Message
           * //*/
          const caption = msg.message.imageMessage.caption;
          const bcRegex = new RegExp(/^\.Bc\s(.+)/i);
          if (bcRegex.test(caption)) {
            logging("info", "Get Message", caption);
            const img = await downloadMediaMessage(
              msg,
              "buffer",
              {},
              { logger }
            );
            writeFileSync(join(__dirname, "../broadcast.jpeg"), img);
            const broadcastTxt = caption.replace(/^\.Bc\s*/i, "");
            const broadcastImg = readFileSync(
              join(__dirname, "../broadcast.jpeg")
            );
            try {
              let sent = 0;
              const loopBroadcast = setInterval(async () => {
                if (groupParticipants.length === sent) {
                  logging(
                    "success",
                    `Broadcast Successfully`,
                    `Sent to ${sent} Users`
                  );
                  clearInterval(loopBroadcast);
                } else {
                  await reybot.sendMessage(groupParticipants[sent], {
                    caption: broadcastTxt,
                    image: broadcastImg,
                    headerType: 4,
                  });
                  sent++;
                  logging(
                    "error",
                    `Broadcast sent ${sent}`,
                    groupParticipants[sent - 1]
                  );
                }
              }, 5000);
            } catch (err) {
              logging("error", "Error Broadcast", err);
            }
          }
          /*///////
           * {*} End Broadcast With Images {*}
           */ //*/
          /*///////
           * {*} Create Sticker {*}
           */ //*/
          const stickerRegex = new RegExp(/^\.Sticker/i);
          if (stickerRegex.test(caption)) {
            logging("info", "Get Message", caption);
            try {
              const img = await downloadMediaMessage(
                msg,
                "buffer",
                {},
                { logger }
              );
              const sticker = await writeExifImg(img, {
                packname: "Reybot ヅ",
                author: "YT: @bayumahadika",
              });
              await reybot.sendMessage(
                groupId,
                { sticker: { url: sticker } },
                { quoted: msg }
              );
            } catch (err) {
              logging("error", "Error create sticker", err);
            }
          }
          /*///////
           * {*} End Sticker {*}
           */ //*/
        }
        /*//////
         * {*} End Message Types Image {*}
         * //*/
      }
    }
    return;
  } else {
    const userId = msg.key.remoteJid;
    saveUsers({ userId });
    if (msg.key && msg.key.fromMe) {
      if (msg.message) {
        /*///////
         * {*} Message Type Text {*}
         */ //*/
        const msgTxt = msg.message.extendedTextMessage
          ? msg.message.extendedTextMessage.text
          : msg.message.conversation;
        if (msg.message && msgTxt) {
          /*///////
           * {*} Start Me {*}
           */ //*/
          const meRegex = new RegExp(/^\.menu/i);
          if (meRegex.test(msgTxt)) {
            try {
              const templateText = `*Reyna ヅ* | Menu\n\n*_Groups Chat:_*\n• .Info = Group Information\n• .Bc [your message] = Broadcast (Broadcast on all anggota group)\n• .Bc [your message] = Broadcast (Broadcast on all anggota group with images)\n• .Clone [new group name] = Cloning Group With All Member\n• .Sticker = Creating Sticker On Group (with images)\n\n*_Private Chat_*\n• .Menu = Show All Fitures Menu\n• .Restart = Restart server\n• .Bc [your message] = Broadcast (Broadcast to database Users)\n• .Bc [your message] = Broadcast (Broadcast to database Users with images)\n• .Save [New Contact Name] = Save with Generate Contact\n• .Sticker = Create sticker (with images)\n\n*Tutorial:* https://www.youtube.com/@bayumahadika`;
              await reybot.sendMessage(
                userId,
                { text: templateText },
                { quoted: msg }
              );
            } catch (err) {
              logging("error", "Error endMessage", err);
            }
          }
          /*///////
           * {*} End Me
           */ //*/
          /*//////
           * {*} Restart Server {*}
           */ //*/
          const regexReload = new RegExp(/^\.Restart/i);
          if (regexReload.test(msgTxt)) {
            logging("info", "Get Message", msgTxt);
            try {
              pm2.restart("all", async (err) => {
                if (err) {
                  await reybot.sendMessage(
                    userId,
                    { text: "*Error Restarting* server" },
                    { quoted: msg }
                  );
                  await reybot.sendMessage(userId, {
                    text: "*Restarting server success*",
                  });
                }
              });
            } catch (err) {
              logging("error", "Can't Reload Server", err);
            }
          }
          /*///////
           * {*} End Restart Socket
           */ //*/
          /*/////
           * {*} Start Broadcast {*}
           */ //*/
          const bcRegex = new RegExp(/^\.Bc/i);
          if (bcRegex.test(msgTxt)) {
            const message = msgTxt.replace(/^\.Bc\s*/i, "");
            broadcast(reybot, msg, userId, message);
          }
          /*///////
           * {*} End Broadcast
           */ //*/
          /*//////
           * {*} Start Save Contacts {*}
           */ //*/
          const contactRegex = new RegExp(/^\.Save\s(.+)/i);
          if (contactRegex.test(msgTxt)) {
            const contactName = msgTxt.replace(/^\.Save\s*/i, "");
            try {
              await reybot.sendMessage(
                userId,
                {
                  sticker: {
                    url: join(__dirname, "../alzf1gcip.webp"),
                  },
                },
                { quoted: msg }
              );
              const isContactExist = contacts.some(
                (contact) => contact === userId
              );
              if (!isContactExist) {
                contacts.push(userId);
                writeFileSync(
                  join(__dirname, "../database/contacts.json"),
                  JSON.stringify(contacts)
                );
                const vcard =
                  "BEGIN:VCARD\n" +
                  "VERSION:3.0\n" +
                  `FN:${contactName}\n` +
                  `TEL;type=CELL;type=VOICE;waid=${userId.split("@")[0]}:+${
                    userId.split("@")[0]
                  }\n` +
                  "END:VCARD";
                await reybot.sendMessage(userId, {
                  contacts: {
                    displayName: `${contactName}`,
                    contacts: [{ vcard }],
                  },
                });
              } else {
                await reybot.sendMessage(userId, {
                  text: "*Nomor ini sudah tersimpan* 🤨",
                });
              }
            } catch (err) {
              logging("error", "Error sendMessage", err);
            }
          }
          /*///////
           * {*} End Save Contact {*}
           */ //*/
          /*//////
           * {*} Snap Group {*}
           */ //*/
          const snapGroupRegex = new RegExp(/^\.snapGroup\s(.+)\|(.+)/i);
          if (snapGroupRegex.test(msgTxt)) {
            logging("info", "Get Messages", msgTxt);
            const matchSnap = msgTxt.match(snapGroupRegex);
            const groupTarget = matchSnap[1];
            const groupAudience = matchSnap[2];
            console.log(groupTarget, groupAudience);
            if (!groupTarget.endsWith("@g.us")) {
              try {
                await reybot.sendMessage(
                  userId,
                  { text: "*Group _Target_ tidak valid*" },
                  { quoted: msg }
                );
              } catch (err) {
                logging("error", "Error sendMessage", err);
              }
            } else if (!groupAudience.endsWith("@g.us")) {
              try {
                await reybot.sendMessage(
                  userId,
                  { text: "*Group _Tujuan_ tidak valid*" },
                  { quoted: ms }
                );
              } catch (err) {
                logging("error", "Error sendMessage", err);
              }
            } else {
              try {
                const metadataGroupTarget = await reybot.groupMetadata(
                  groupTarget
                );
                const metadataGroupAudience = await reybot.groupMetadata(
                  groupAudience
                );
                if (!metadataGroupTarget) {
                  try {
                    await reybot.sendMessage(
                      userId,
                      { text: "*Group _Target_ tidak ditemukan*" },
                      { quoted: msg }
                    );
                  } catch (err) {
                    logging("error", "Error sendMessage", err);
                  }
                }
                if (!metadataGroupAudience) {
                  try {
                    await reybot.sendMessage(
                      userId,
                      { text: "*Group _Tujuan_ tidak ditemukan*" },
                      { quoted: msg }
                    );
                  } catch (err) {
                    logging("error", "Error sendMessage", err);
                  }
                }
                const participantsGroupTarget =
                  metadataGroupTarget.participants.map((part) => part.id);
                const participantsGroupAudience =
                  metadataGroupAudience.participants.map((part) => part.id);
                if (participantsGroupAudience.length > 900) {
                  try {
                    await reybot.sendMessage(
                      userId,
                      { text: `*Anggota Group Tujuan Hampir Penuh*` },
                      { quoted: msg }
                    );
                  } catch (err) {
                    logging("error", "Error sendMessage", err);
                  }
                }
              } catch (err) {
                logging("error", "Failed Snapping Group", err);
              }
            }
          }
          /*/////
           * {*} Ends Snap Group {*}
           */ //*/
        }
        /*//////
         * {*} End Message Types Text / Conversation {*}
         */ //*/
        /*//////
         * {*} Start Chat Types Image {*}
         */ //*/
        const msgImg = msg.message.imageMessage;
        if (msg.message && msgImg) {
          /*////////
           * {*} Broadcast With Images {*}
           */ //*/
          const caption = msg.message.imageMessage.caption;
          const bcRegex = new RegExp(/^\.Bc/i);
          if (bcRegex.test(caption)) {
            try {
              const img = await downloadMediaMessage(
                msg,
                "buffer",
                {},
                { logger }
              );
              writeFileSync(join(__dirname, "../image.jpeg"), img);
            } catch (err) {
              logging("info", "Error save Image", err);
            } finally {
              const message = caption.replace(/^\.Bc\s*/i, "");
              const imgMessage = readFileSync(join(__dirname, "../image.jpeg"));
              broadcast(reybot, msg, userId, message, imgMessage);
            }
          }
          /*///////
           * {*} End Broadcast With Images {*}
           */ //*/
          /*///////
           * {*} Create Sticker {*}
           */ //*/
          const stickerRegex = new RegExp(/^\.Sticker/i);
          if (stickerRegex.test(caption)) {
            try {
              const img = await downloadMediaMessage(
                msg,
                "buffer",
                {},
                { logger }
              );
              const sticker = await writeExifImg(img, {
                packname: "Reybot ヅ",
                author: "YT: @bayumahadika",
              });
              await reybot.sendMessage(
                userId,
                { sticker: { url: sticker } },
                { quoted: msg }
              );
            } catch (err) {
              logging("error", "Can't Create Sticker", err);
            }
          }
          /*//////
           * {*} End Create Sticker {*}
           */ //*/
        }
        /*////////
         * {*} End Message Types Image {*}
         */ //*/
      }
    }
  }
  return;
};

const broadcast = async (reybot, msg, userId, message, imgMessage) => {
  const users = JSON.parse(
    readFileSync(join(__dirname, "../database/users.json"))
  );
  const contacts = JSON.parse(
    readFileSync(join(__dirname, "../database/contacts.json"))
  );
  let sent = 1;
  const filteredUsers = users.filter((user) => !contacts.includes(user));
  if (filteredUsers.length <= 0) {
    try {
      await reybot.sendMessage(
        userId,
        {
          text: `*Database Users ${filteredUsers.length}*\n\nSilahkan join kebeberapa *Group*, Untuk mendapatkan user`,
        },
        { quoted: msg }
      );
    } catch (err) {
      logging("error", "Error sendMessage", err);
    }
  } else {
    try {
      await reybot.sendMessage(
        userId,
        {
          text: `*Broadcast start*\n\n*Target: ${filteredUsers.length} users*`,
        },
        { quoted: msg }
      );
    } catch (err) {
      logging("error", "Error sendMessage", err);
    } finally {
      const loopBroadcast = setInterval(async () => {
        if (!imgMessage) {
          try {
            await reybot.sendMessage(filteredUsers[0], {
              text: `${message}`,
            });
            logging("success", `Broadcast sent ${sent}`, filteredUsers[0]);
          } catch (err) {
            logging("error", `Brodcast Gagal ${sent}`, err);
          }
        } else {
          try {
            await reybot.sendMessage(filteredUsers[0], {
              caption: message,
              image: imgMessage,
              headerType: 4,
            });
            logging("success", `Broadcast sent ${sent}`, filteredUsers[0]);
          } catch (err) {
            logging("error", `Broadcast Gagal ${sent}`, err);
          }
        }
        if (0 === filteredUsers.length - 1) {
          try {
            await reybot.sendMessage(userId, {
              text: `*BROADCAST SUCCESSFUL*\n${sent} Messages sent`,
            });
          } catch (err) {
            logging("error", "Error sendMessage", err);
          }
          clearInterval(loopBroadcast);
        }
        filteredUsers.splice(0, 1);
        writeFileSync(
          join(__dirname, "../database/users.json"),
          JSON.stringify(filteredUsers)
        );
        sent++;
      }, 5000);
    }
  }
};

async function imageToWebp(media) {
  const tmpFileOut = join(
    tmpdir(),
    `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileIn = join(
    tmpdir(),
    `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`
  );

  writeFileSync(tmpFileIn, media);

  await new Promise((resolve, reject) => {
    ff(tmpFileIn)
      .on("error", reject)
      .on("end", () => resolve(true))
      .addOutputOptions([
        "-vcodec",
        "libwebp",
        "-vf",
        "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
      ])
      .toFormat("webp")
      .save(tmpFileOut);
  });

  const buff = readFileSync(tmpFileOut);
  unlinkSync(tmpFileOut);
  unlinkSync(tmpFileIn);
  return buff;
}

async function writeExifImg(media, metadata) {
  let wMedia = await imageToWebp(media);
  const tmpFileIn = join(
    tmpdir(),
    `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  const tmpFileOut = join(
    tmpdir(),
    `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`
  );
  writeFileSync(tmpFileIn, wMedia);

  if (metadata.packname || metadata.author) {
    const img = new webp.Image();
    const json = {
      "sticker-pack-id": `https://github.com/DikaArdnt/Hisoka-Morou`,
      "sticker-pack-name": metadata.packname,
      "sticker-pack-publisher": metadata.author,
      emojis: metadata.categories ? metadata.categories : [""],
    };
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    await img.load(tmpFileIn);
    unlinkSync(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return tmpFileOut;
  }
}
