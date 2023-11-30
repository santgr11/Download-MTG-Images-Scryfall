const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SAVE_FOLDER_NAME = 'update29112023';

const cards = fs
  .readFileSync('cartas.txt')
  .toString()
  .split('\r\n')
  .map(card => card.replace(' // ', '-'));

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

const notFoundCards = []; // Cards not found with the given name
const errorFindingCards = []; // Cards which name created an error in the search

const downloadAllImages = async () => {
  const listToUse = failedCards.length > 0 ? [...failedCards] : cards;
  failedCards.length = 0;
  console.log('Downloading', listToUse.length, 'card images');
  Promise.all(
    listToUse.map(async card => {
      try {
        const url = `https://api.scryfall.com/cards/named?fuzzy=${card}`;

        const cardSearchResponse = await axios.get(url);
        const cardSearchData = cardSearchResponse.data;
        const printsSearchResponse = await axios.get(
          cardSearchData.prints_search_uri
        );
        const printsSearchData = printsSearchResponse.data.data;

        const highResOption = printsSearchData.find(objectData => {
          return (
            objectData.highres_image === true &&
            objectData.digital === false &&
            !objectData.frame_effects &&
            objectData.promo === false
          );
        });

        const cardToDownload = highResOption || cardSearchData;

        if (
          cardToDownload.card_faces &&
          cardToDownload.card_faces[0].image_uris
        ) {
          cardToDownload.card_faces.forEach(async face => {
            return downloadImage(face.image_uris.png, face.name);
          });
        } else {
          if (cardToDownload.name.includes('//')) {
            cardToDownload.name = cardToDownload.name.replace('//', '-');
          }
          return downloadImage(
            cardToDownload.image_uris.png,
            cardToDownload.name
          );
        }
      } catch (error) {
        console.log(`${card} failed to download: ${error}`);
        if (error.response.status === 404 || error.response.status === 400) {
          notFoundCards.push(card);
        } else if (error.response.status === 400) {
          errorFindingCards.push(card);
        } else {
          failedCards.push(card);
        }
      }
    })
  ).then(() => {
    if (failedCards.length > 0) {
      console.log(
        'A total of ' + failedCards.length + ' cards failed to download'
      );
      console.log('Retrying after 5 seconds');

      setTimeout(downloadAllImages, 5000);
    } else {
      fs.appendFile(
        'notFoundCards.txt',
        `${notFoundCards.join('\n')}\n`,
        error => {
          if (error) throw error;
        }
      );

      fs.appendFile(
        'errorFindingCards.txt',
        `${errorFindingCards.join('\n')}\n`,
        error => {
          if (error) throw error;
        }
      );
    }
  });
};

downloadAllImages();
