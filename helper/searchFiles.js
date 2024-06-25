import createFile from "../models/createFile.js";
import Fuse from "fuse.js";
import bot from "../config/bot.js";
import allButtons from "../config/allButtons.js";
import generateInlineKeyboards from "./generateInlineKeyboards.js";

// Function to fetch all files from the specified channels
const allFiles = async (channels) => {
  let data = [];

  for await (const channelId of channels) {
    const File = createFile(channelId);
    const files = await File.find({});

    for await (const file of files) {
      data.push({
        fromId: channelId,
        caption: file.caption,
        messageId: file._id,
        fileSize: file.fileSize,
      });
    }
  }
  return data;
};

// Function to search files using Fuse.js
const searchFromFiles = (query, data) => {
  const option = {
    keys: ["caption"],
    threshold: 0.2,
  };

  const fuse = new Fuse(data, option);
  let filteredData = fuse.search(query.toLowerCase());

  return filteredData.map((d) => d.item);
};

// Function to split a list into chunks of a specified size
const splitList = (list, index) => {
  const result = [];
  for (let i = 0; i < list.length; i += index) {
    result.push(list.slice(i, i + index));
  }
  return result;
};

// Function to schedule the deletion of a message after a delay
async function autoDeleteMessage(chatId, messageId, delay) {
  setTimeout(async () => {
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error(`Failed to delete message ${messageId} in chat ${chatId}:`, error);
    }
  }, delay);
}

// Function to generate buttons with auto-delete feature
export async function generateButtons(data, query, messageId, chatId) {
  let buttons = [];

  const me = await bot.getMe();
  const botLink = "t.me/" + me.username;

  data.forEach((item) => {
    buttons.push([
      {
        text: `📂 [${item.fileSize}MB] ${item.caption}`,
        url: `${botLink}?start=${item.fromId}-${item.messageId}`,
      },
    ]);
  });

  let keyword = `${chatId}-${messageId}`;
  const sendAllFileLink = `${botLink}?start=search-${chatId}-${query
    .replace(/ /g, "-")
    .replace(/[\(\)]/g, "")
    .replace(/:/g, "")
    .toLowerCase()}`;

  if (buttons.length > 10) {
    let splittedButtons = splitList(buttons, 10);

    allButtons[keyword] = {
      total: splittedButtons.length,
      buttons: splittedButtons,
      sendAllFileLink,
    };

    const filteredButtons = generateInlineKeyboards(
      allButtons[keyword].buttons[0],
      {
        nextLink: `next_0_${keyword}`,
        sendAllFileLink,
        pages: {
          currentPage: 1,
          totalPages: allButtons[keyword].total,
        },
      }
    );

    // Add auto-delete for the message
    autoDeleteMessage(chatId, messageId, 10 * 60 * 1000); // Auto-delete after 10 minutes

    return filteredButtons;
  } else {
    const buttonsWithAutoDelete = generateInlineKeyboards(buttons, { sendAllFileLink });

    // Add auto-delete for the message
    autoDeleteMessage(chatId, messageId, 10 * 60 * 1000); // Auto-delete after 10 minutes

    return buttonsWithAutoDelete;
  }
}

// Function to search files and return the filtered data
export async function searchFiles(query, channels) {
  let data = await allFiles(channels);
  let filteredData = searchFromFiles(query, data);

  return filteredData;
}
