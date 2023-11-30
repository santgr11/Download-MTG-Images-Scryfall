const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SAVE_FOLDER_NAME = 'update29112023';

const cards = fs
  .readFileSync('cartas.txt')
  .toString()
  .split('\r\n')
  .map((card) => card.replace(' // ', '-'));

const downloadImage = async (url, name) => {
  const imageBuffer = await axios.get(url, { responseType: 'stream' });

  if (!fs.existsSync(path.resolve(__dirname, 'images', SAVE_FOLDER_NAME))) {
    fs.mkdirSync(path.resolve(__dirname, 'images', SAVE_FOLDER_NAME));
  }

  const writer = fs.createWriteStream(
    path.resolve(__dirname, 'images', SAVE_FOLDER_NAME, `${name}.png`)
  );
  imageBuffer.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

const failedCards = [];

cards.forEach(async (card) => {
  try {
    const url = `https://api.scryfall.com/cards/named?fuzzy=${card}`;

    const cardSearchResponse = await axios.get(url);
    const cardSearchData = cardSearchResponse.data;
    const printsSearchResponse = await axios.get(
      cardSearchData.prints_search_uri
    );
    const printsSearchData = printsSearchResponse.data.data;

    const highResOption = printsSearchData.find((objectData) => {
      return (
        objectData.highres_image === true &&
        objectData.digital === false &&
        !objectData.frame_effects &&
        objectData.promo === false
      );
    });

    const cardToDownload = highResOption || cardSearchData;

    if (cardToDownload.card_faces && cardToDownload.card_faces[0].image_uris) {
      cardToDownload.card_faces.forEach(async (face) => {
        await downloadImage(face.image_uris.png, face.name);
      });
    } else {
      if (cardToDownload.name.includes('//')) {
        cardToDownload.name = cardToDownload.name.replace('//', '-');
      }
      await downloadImage(cardToDownload.image_uris.png, cardToDownload.name);
    }
  } catch (error) {
    console.log(`${card} failed to download: ${error}`);
    failedCards.push(card);
  }
});

fs.appendFileSync(
  'failedCards.txt',
  `${failedCards.join('\n')}\n`,
  (error) => {
    if (error) throw error;
  }
);
