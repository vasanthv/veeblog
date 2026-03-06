const { parseFeed, processFeed } = require("./");

describe("parseFeed", () => {
	it("should throw an error if the XML is invalid", async () => {
		const invalidXML = "<rss><channel></rss>";
		await expect(parseFeed(invalidXML)).rejects.toThrow("Unexpected close tag");
	});

	it("should throw an error for empty XML content", async () => {
		await expect(parseFeed("   ")).rejects.toThrow("Feed content is empty or not text");
	});

	it("should parse a valid XML feed and return items with channel metadata", async () => {
		const validXML = `
      <rss version="2">
        <channel>
          <title>Test Feed</title>
          <link>https://example.com/feed-home</link>
          <description>Test feed description</description>
          <feedUrl>https://example.com/feed.xml</feedUrl>
          <item>
            <title>Test Item</title>
            <link>https://example.com/item</link>
            <pubDate>2025-03-09T12:00:00Z</pubDate>
            <guid>12345</guid>
          </item>
        </channel>
      </rss>
    `;

		const result = await parseFeed(validXML);
		const channels = result.channels ?? result.channel;
		expect(Array.isArray(result.items)).toBe(true);
		expect(channels).toMatchObject({
			title: "Test Feed",
			image: undefined,
			link: "https://example.com/feed-home",
			description: "Test feed description",
		});
		expect(channels).toHaveProperty("feedUrl");
		expect(result.items).toEqual([
			{
				guid: "12345",
				title: "Test Item",
				link: "https://example.com/item",
				channel: {
					title: "Test Feed",
					link: "https://example.com/feed-home",
					image: undefined,
				},
				publishedOn: "2025-03-09T12:00:00Z",
			},
		]);
	});

	it("should tolerate invalid item dates and set publishedOn to a future fallback date", async () => {
		const xmlWithBadDate = `
      <rss version="2">
        <channel>
          <feedUrl>https://example.com/bad-date-feed.xml</feedUrl>
          <item>
            <title>Invalid Date Item</title>
            <link>https://example.com/invalid-date</link>
            <pubDate>not-a-date</pubDate>
          </item>
        </channel>
      </rss>
    `;

		const result = await parseFeed(xmlWithBadDate);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe("Invalid Date Item");
		expect(result.items[0].link).toBe("https://example.com/invalid-date");
		expect(result.items[0].guid).toBe("https://example.com/invalid-date");
		expect(result.items[0].publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(new Date(result.items[0].publishedOn).getTime()).toBeGreaterThan(Date.now());
	});
});

describe("processFeed", () => {
	it("should throw a friendly error for an invalid feed URL", async () => {
		await expect(processFeed("not-a-valid-url")).rejects.toThrow("Invalid feed URL");
	});
});
