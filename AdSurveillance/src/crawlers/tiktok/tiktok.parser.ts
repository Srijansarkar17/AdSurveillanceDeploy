// export async function parseTikTokAds(page: any) {
//     return await page.$$eval(
//       'div',
//       (nodes: Element[]) => {
//         return nodes
//           .map(node => node.textContent || '')
//           .filter(text => text.length > 60)
//           .slice(0, 5)
//           .map(text => ({
//             advertiser: 'TikTok Advertiser',
//             creative: text.slice(0, 300)
//           }));
//       }
//     ).catch(() => []);
//   }
  