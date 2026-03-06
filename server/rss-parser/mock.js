const mockRSS = [
	{
		rss: `<rss version="2">
            <channel>
              <title>Mixed Structure Feed</title>
              <link>https://mixedstructurefeed.com</link>
              <feedUrl>https://mixedstructurefeed.com/feed</feedUrl>
              <description>Feed with items of different structures</description>
              
              <item>
                <title>Item with all data</title>
                <link>https://mixedstructurefeed.com/item1</link>
                <pubDate>2025-03-25T08:00:00Z</pubDate>
                <guid>12345</guid>
              </item>

              <item>
                <title>Item with missing link</title>
                <link></link>
                <pubDate>2025-03-26T09:00:00Z</pubDate>
                <guid>67890</guid>
              </item>

              <item>
                <title>Item with missing date</title>
                <link>https://mixedstructurefeed.com/item3</link>
                <pubDate></pubDate>
                <guid>11223</guid>
              </item>

              <item>
                <title></title>
                <link>https://mixedstructurefeed.com/item4</link>
                <pubDate>2025-03-27T10:00:00Z</pubDate>
              </item>
            </channel>
          </rss>`,
		expected: {
			channel: {
				title: "Mixed Structure Feed",
				image: undefined,
				link: "https://mixedstructurefeed.com",
				description: "Feed with items of different structures",
			},
			items: [
				{
					title: "Item with all data",
					link: "https://mixedstructurefeed.com/item1",
					publishedOn: "2025-03-25T08:00:00Z",
					guid: "12345",
				},
			],
		},
	},
];

module.exports = { mockRSS };
