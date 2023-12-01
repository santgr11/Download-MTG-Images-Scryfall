import {
  readFileSync,
  existsSync,
  mkdirSync,
  createWriteStream,
  appendFile
} from 'fs';
import { resolve as _resolve } from 'path';
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const SAVE_FOLDER_NAME = 'update29112023';

const client = rateLimit(axios.create(), {
  maxRequests: 10,
  perMilliseconds: 1000,
  maxRPS: 10
});

const cards = readFileSync('cartas.txt')
  .toString()
  .split('\r\n')
  .filter(card => card !== '')
  .map(card => card.replace(' // ', '-'));

const downloadImage = async (url, name) => {
  const imageBuffer = await client.get(url, { responseType: 'stream' });

  if (!existsSync(_resolve(__dirname, 'images', SAVE_FOLDER_NAME))) {
    mkdirSync(_resolve(__dirname, 'images', SAVE_FOLDER_NAME));
  }

  const writer = createWriteStream(
    _resolve(__dirname, 'images', SAVE_FOLDER_NAME, `${name}.png`)
  );
  imageBuffer.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

const failedCards = [];

const downloadAllImages = async () => {
  console.log('Downloading', cards.length, 'card images');
  Promise.all(
    cards.map(async card => {
      try {
        const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(
          card
        )}`;

        const cardSearchResponse = await client.get(url);
        const cardSearchData = cardSearchResponse.data;
        const printsSearchResponse = await client.get(
          cardSearchData.prints_search_uri
        );
        const printsSearchData = printsSearchResponse.data.data;

        const highResOption = printsSearchData.find(objectData => {
          return (
            objectData.highres_image === true &&
            objectData.digital === false &&
            !objectData.frame_effects &&
            objectData.promo === false &&
            objectData.set_name !== 'Secret Lair Drop' &&
            objectData.border_color !== 'gold'
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

        failedCards.push(`${card}: ${error.data?.details}`);
      }
    })
  ).then(() => {
    if (failedCards.length > 0) {
      console.log(`A total of ${failedCards.length} cards failed to download`);

      appendFile('failedCards.txt', `${failedCards.join('\n')}\n`, error => {
        if (error) throw error;
      });
    } else {
      console.log('All cards downloaded successfully');
    }
  });
};

downloadAllImages();
