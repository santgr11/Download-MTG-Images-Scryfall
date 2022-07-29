const fs = require('fs');
const path = require('path');
const axios = require('axios');

const cards = fs.readFileSync('cartas.txt').toString().split('\r\n');

const downlaodImage = async (url, name) => {
  const imageBuffer = await axios.get(url, { responseType: 'stream' });

  const writer = fs.createWriteStream(
    path.resolve(__dirname, 'images', `${name}.png`)
  );
  imageBuffer.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

cards.forEach(async (card) => {
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

  if (cardToDownload.card_faces) {
    cardToDownload.card_faces.forEach(async (face) => {
      await downlaodImage(face.image_uris.png, face.name);
    });
  } else {
    await downlaodImage(cardToDownload.image_uris.png, cardToDownload.name);
  }
});
