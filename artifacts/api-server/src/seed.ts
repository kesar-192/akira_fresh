import { eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  activitiesTable,
  adEventsTable,
  adsTable,
  brandsTable,
  leadsTable,
  scheduledPostsTable,
  socialAccountsTable,
  type Ad,
  type Brand,
} from "@workspace/db";
import { logger } from "./lib/logger";

async function seed(): Promise<void> {
  const existingBrands = await db.select().from(brandsTable);
  if (existingBrands.length >= 3) {
    logger.info("AdPilot demo data already exists; seed skipped");
    return;
  }

  const brandFixtures = [
    {
      name: "Aster & Vale",
      industry: "Beauty & skincare",
      description: "Plant-powered skincare for slower, softer evenings.",
      primaryColor: "#9A5B78",
      secondaryColor: "#F5E7EC",
    },
    {
      name: "Loom & Lark",
      industry: "Home & lifestyle",
      description: "Everyday objects made to bring a little more warmth home.",
      primaryColor: "#C7764A",
      secondaryColor: "#F5EBDD",
    },
    {
      name: "Grove Rituals",
      industry: "Wellness",
      description: "Small, grounding rituals for busy, full lives.",
      primaryColor: "#486D5E",
      secondaryColor: "#E8F0E8",
    },
  ];

  const brands: Brand[] = [];
  for (const fixture of brandFixtures) {
    const [existing] = await db.select().from(brandsTable).where(eq(brandsTable.name, fixture.name)).limit(1);
    const [brand] = existing
      ? [existing]
      : await db.insert(brandsTable).values(fixture).returning();
    brands.push(brand);
  }

  const adFixtures = [
    {
      brandIndex: 0,
      name: "Your evening-skin ritual",
      type: "quiz" as const,
      slug: "aster-evening-ritual",
      headline: "What does your skin need tonight?",
      body: "Find the little ritual that feels right for your skin.",
      ctaLabel: "Find my ritual",
      config: {
        question: "What is your skin asking for?",
        options: ["A little more glow", "A calm reset", "Deep hydration"],
        result: "Your ritual is waiting.",
      },
      impressions: 5820,
      interactions: 1427,
      leads: 86,
    },
    {
      brandIndex: 0,
      name: "The glow check",
      type: "poll" as const,
      slug: "aster-glow-check",
      headline: "What is your glow mood?",
      body: "Tap your pick. We will meet you there.",
      ctaLabel: "Vote now",
      config: { question: "What is your glow mood?", options: ["Dewy", "Soft matte", "Bare skin"] },
      impressions: 3110,
      interactions: 924,
      leads: 42,
    },
    {
      brandIndex: 1,
      name: "The little home edit",
      type: "carousel" as const,
      slug: "loom-little-home-edit",
      headline: "Find your softer corner",
      body: "Swipe through the pieces we keep coming back to.",
      ctaLabel: "Shop the edit",
      config: {
        slides: [
          { title: "A slower morning", body: "Linen, light, and one good cup." },
          { title: "The soft landing", body: "Textures that make coming home feel better." },
          { title: "A place for pause", body: "Make room for the little things." },
        ],
      },
      impressions: 4370,
      interactions: 1196,
      leads: 31,
    },
    {
      brandIndex: 1,
      name: "Pick your palette",
      type: "swipe_cards" as const,
      slug: "loom-pick-your-palette",
      headline: "Which room feels like you?",
      body: "Swipe to discover your everyday palette.",
      ctaLabel: "See the collection",
      config: { cards: ["sunwashed", "earthy", "quiet blue"] },
      impressions: 2640,
      interactions: 761,
      leads: 18,
    },
    {
      brandIndex: 2,
      name: "A moment for you",
      type: "spin_wheel" as const,
      slug: "grove-a-moment-for-you",
      headline: "Take a breath. Pick a ritual.",
      body: "One small moment can change the shape of a day.",
      ctaLabel: "Spin for a ritual",
      config: { rewards: ["A quiet cup of tea", "A five-minute stretch", "Step outside", "Write one good thing"] },
      impressions: 1930,
      interactions: 638,
      leads: 54,
    },
    {
      brandIndex: 2,
      name: "Find your reset",
      type: "lead_form" as const,
      slug: "grove-find-your-reset",
      headline: "A reset, made for you",
      body: "Tell us where you would like a little more ease.",
      ctaLabel: "Send me my guide",
      config: { fields: ["name", "email"], consentRequired: true },
      impressions: 1480,
      interactions: 309,
      leads: 63,
    },
  ];

  const ads: Ad[] = [];
  for (const fixture of adFixtures) {
    const [existing] = await db.select().from(adsTable).where(eq(adsTable.slug, fixture.slug)).limit(1);
    if (existing) {
      ads.push(existing);
      continue;
    }
    const [ad] = await db
      .insert(adsTable)
      .values({
        brandId: brands[fixture.brandIndex].id,
        name: fixture.name,
        type: fixture.type,
        status: "published",
        slug: fixture.slug,
        headline: fixture.headline,
        body: fixture.body,
        ctaLabel: fixture.ctaLabel,
        accentColor: brands[fixture.brandIndex].primaryColor,
        config: fixture.config,
        impressions: fixture.impressions,
        interactions: fixture.interactions,
        leads: fixture.leads,
        publishedAt: new Date(Date.now() - 8 * 86400000),
      })
      .returning();
    ads.push(ad);
  }

  const socialFixtures = [
    { brandIndex: 0, platform: "instagram" as const, handle: "@asterandvale", followers: 28400 },
    { brandIndex: 0, platform: "facebook" as const, handle: "Aster & Vale", followers: 12300 },
    { brandIndex: 1, platform: "instagram" as const, handle: "@loomandlark", followers: 19200 },
    { brandIndex: 1, platform: "pinterest" as const, handle: "Loom & Lark", followers: 8600 },
    { brandIndex: 2, platform: "linkedin" as const, handle: "Grove Rituals", followers: 4130 },
    { brandIndex: 2, platform: "x" as const, handle: "@groverituals", followers: 2990 },
  ];
  for (const fixture of socialFixtures) {
    const [existing] = await db
      .select()
      .from(socialAccountsTable)
      .where(eq(socialAccountsTable.handle, fixture.handle))
      .limit(1);
    if (!existing) {
      await db.insert(socialAccountsTable).values({
        brandId: brands[fixture.brandIndex].id,
        platform: fixture.platform === "pinterest" ? "instagram" : fixture.platform,
        handle: fixture.handle,
        status: "connected",
        followers: fixture.followers,
        lastSyncedAt: new Date(Date.now() - 45 * 60000),
      });
    }
  }

  const postFixtures = [
    { brandIndex: 0, adIndex: 0, caption: "A softer end to the day starts with a ritual that feels like yours.", platform: "instagram", offset: 4 },
    { brandIndex: 1, adIndex: 2, caption: "Three little corners, three ways to make home feel more like home.", platform: "facebook", offset: 26 },
    { brandIndex: 2, adIndex: 4, caption: "A tiny pause is still a pause. Take yours today.", platform: "linkedin", offset: 51 },
    { brandIndex: 0, adIndex: 1, caption: "A quick glow check-in. Which one are you reaching for?", platform: "facebook", offset: -28 },
  ];
  const existingPosts = await db.select({ id: scheduledPostsTable.id }).from(scheduledPostsTable).limit(1);
  if (!existingPosts.length) {
    await db.insert(scheduledPostsTable).values(
      postFixtures.map((fixture) => ({
        brandId: brands[fixture.brandIndex].id,
        adId: ads[fixture.adIndex].id,
        caption: fixture.caption,
        platforms: [fixture.platform],
        scheduledAt: new Date(Date.now() + fixture.offset * 3600000),
        status: fixture.offset < 0 ? "published" as const : "scheduled" as const,
      })),
    );
  }

  const existingLeads = await db.select({ id: leadsTable.id }).from(leadsTable).limit(1);
  if (!existingLeads.length) {
    const leadFixtures = [
      { adIndex: 0, name: "Maya Patel", email: "maya@example.com", phone: null },
      { adIndex: 2, name: "Robin Chen", email: "robin@example.com", phone: "+1 415 555 0103" },
      { adIndex: 4, name: "Sam Rivera", email: "sam@example.com", phone: null },
      { adIndex: 5, name: "Alex Kim", email: "alex@example.com", phone: "+1 415 555 0182" },
    ];
    await db.insert(leadsTable).values(
      leadFixtures.map((lead, index) => ({
        brandId: ads[lead.adIndex].brandId,
        adId: ads[lead.adIndex].id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        consent: true,
        createdAt: new Date(Date.now() - (index + 1) * 86400000),
      })),
    );
  }

  const existingEvents = await db.select({ id: adEventsTable.id }).from(adEventsTable).limit(1);
  if (!existingEvents.length) {
    const eventRows = Array.from({ length: 48 }, (_, index) => {
      const ad = ads[index % ads.length];
      const dayOffset = index % 28;
      const kind = index % 11 === 0 ? "lead_submit" as const : index % 4 === 0 ? "interaction" as const : "view" as const;
      return {
        adId: ad.id,
        eventType: kind,
        metadata: {
          platform: platformsForSeed[index % 4],
          demo: true,
        },
        createdAt: new Date(Date.now() - dayOffset * 86400000 - (index % 24) * 3600000),
      };
    });
    await db.insert(adEventsTable).values(eventRows);
  }

  const existingActivity = await db.select({ id: activitiesTable.id }).from(activitiesTable).limit(1);
  if (!existingActivity.length) {
    await db.insert(activitiesTable).values([
      { brandId: brands[0].id, action: "published an interactive quiz", target: "Your evening-skin ritual", createdAt: new Date(Date.now() - 2 * 3600000) },
      { brandId: brands[1].id, action: "scheduled a carousel", target: "The little home edit", createdAt: new Date(Date.now() - 6 * 3600000) },
      { brandId: brands[2].id, action: "captured a new lead", target: "A moment for you", createdAt: new Date(Date.now() - 20 * 3600000) },
    ]);
  }

  logger.info({ brands: brands.length, ads: ads.length }, "AdPilot demo data seeded");
}

const platformsForSeed = ["instagram", "facebook", "linkedin", "x"];

seed()
  .catch((error: unknown) => {
    logger.error({ err: error }, "AdPilot seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
