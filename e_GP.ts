import http from 'http';
import xml2js from 'xml2js';
import iconv from 'iconv-lite';

interface Item {
  title?: string;
  link?: string;
  pubDate?: string;
  announceType?: string;
  egpid?: string;
  [key: string]: any;
}

interface ParsedData {
  rss: {
    channel: [{
      item: Item[];
    }];
  };
}

const parser = new xml2js.Parser();
const myData: Item[] = [];

async function fetchData(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks: Uint8Array[] = [];

      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const decodedContent = iconv.decode(buffer, 'win874');
        resolve(decodedContent);
      });

      response.on('error', reject);
    }).on('error', reject);
  });
}

async function parseAndProcessData(response: string, announceType: string, deptId: string): Promise<void> {
  try {
    const parsedData: ParsedData = await parser.parseStringPromise(response);
    const items = parsedData.rss.channel[0].item || [];

    items.forEach(item => {
      const listData: Item = {};

      for (const [key, value] of Object.entries(item)) {
        if (key !== 'guid') {
          listData[key] = value[0];
        }
      }

      listData['announceType'] = announceType;
      listData['egpid'] = deptId;
      myData.push(listData);
    });
  } catch (error) {
    console.error(`Error parsing XML for deptId: ${deptId}, announceType: ${announceType}`, error);
  }
}

async function fetchAndParse(announceType: string, deptId: string): Promise<void> {
  const baseUrl = 'http://process3.gprocurement.go.th/EPROCRssFeedWeb/egpannouncerss.xml';
  const url = `${baseUrl}?deptId=${deptId}&anounceType=${announceType}`;
  try {
    const response = await fetchData(url);
    await parseAndProcessData(response, announceType, deptId);
  } catch (error) {
    console.error(`Error fetching or parsing XML for deptId: ${deptId}, announceType: ${announceType}`, error);
  }
}

export async function e_GP(deptIds: string[]): Promise<string> {
  const announceTypes = ['W0', 'W2', 'B0', 'D0', 'D1', 'D2', 'P0', 'W1', '15'];

  try {
    const tasks = deptIds
      .filter(deptId => deptId)
      .flatMap(deptId => announceTypes.map(announceType => fetchAndParse(announceType, deptId)));

    await Promise.all(tasks);
  } catch (error) {
    console.error('Error in processing tasks:', error);
  }

  return JSON.stringify(myData);
}
