import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateAdBody,
  CreateAdResponse,
  CreateBrandBody,
  CreateBrandResponse,
  CreateScheduledPostBody,
  CreateScheduledPostResponse,
  ConnectSocialAccountBody,
  ConnectSocialAccountResponse,
  DeleteAdParams,
  DeleteAdResponse,
  DeleteBrandParams,
  DeleteBrandResponse,
  DeleteScheduledPostParams,
  DeleteScheduledPostResponse,
  DisconnectSocialAccountParams,
  DisconnectSocialAccountResponse,
  GetAdParams,
  GetAdResponse,
  GetAnalyticsQueryParams,
  GetAnalyticsResponse,
  GetDashboardQueryParams,
  GetDashboardResponse,
  GetPublicAdParams,
  GetPublicAdResponse,
  InviteTeamMemberBody,
  InviteTeamMemberResponse,
  ListActivitiesQueryParams,
  ListActivitiesResponse,
  ListAdsQueryParams,
  ListAdsResponse,
  ListBrandsResponse,
  ListLeadsQueryParams,
  ListLeadsResponse,
  ListScheduledPostsQueryParams,
  ListScheduledPostsResponse,
  ListSocialAccountsParams,
  ListSocialAccountsResponse,
  ListTeamMembersResponse,
  RecordPublicAdEventBody,
  RecordPublicAdEventParams,
  RecordPublicAdEventResponse,
  RemoveTeamMemberParams,
  RemoveTeamMemberResponse,
  SubmitPublicLeadBody,
  SubmitPublicLeadParams,
  SubmitPublicLeadResponse,
  UpdateAdBody,
  UpdateAdParams,
  UpdateAdResponse,
  UpdateBrandBody,
  UpdateBrandParams,
  UpdateBrandResponse,
  UpdateScheduledPostBody,
  UpdateScheduledPostParams,
  UpdateScheduledPostResponse,
  UpdateTeamMemberBody,
  UpdateTeamMemberParams,
  UpdateTeamMemberResponse,
} from "@workspace/api-zod";
import {
  activitiesTable,
  adEventsTable,
  adsTable,
  brandsTable,
  db,
  leadsTable,
  scheduledPostsTable,
  socialAccountsTable,
  teamMembersTable,
} from "@workspace/db";
import { actorFor, attachActor, canAccessBrand, requireAgencyAdmin, type Actor } from "../lib/auth";

const router: IRouter = Router();
const publicRouter: IRouter = Router();
const privateRouter: IRouter = Router();
const platforms = ["instagram", "facebook", "linkedin", "x"] as const;

function idFrom(value: string | string[]): number {
  return Number(Array.isArray(value) ? value[0] : value);
}

function brandScope(actor: Actor, table: typeof brandsTable): SQL | undefined {
  if (actor.role === "agency_admin") return undefined;
  return actor.brandIds.length ? inArray(table.id, actor.brandIds) : sql`false`;
}

async function visibleBrandIds(actor: Actor): Promise<number[]> {
  if (actor.role !== "agency_admin") return actor.brandIds;
  const rows = await db.select({ id: brandsTable.id }).from(brandsTable);
  return rows.map((row) => row.id);
}

async function addActivity(brandId: number | null, action: string, target: string): Promise<void> {
  await db.insert(activitiesTable).values({ brandId, action, target });
}

async function getPublishedAd(slug: string): Promise<{ ad: typeof adsTable.$inferSelect; brand: typeof brandsTable.$inferSelect } | null> {
  const [ad] = await db
    .select()
    .from(adsTable)
    .where(and(eq(adsTable.slug, slug), eq(adsTable.status, "published")))
    .limit(1);
  if (!ad) return null;
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, ad.brandId)).limit(1);
  return brand ? { ad, brand } : null;
}

publicRouter.get("/public/ads/:slug", async (req, res): Promise<void> => {
  const params = GetPublicAdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const result = await getPublishedAd(params.data.slug);
  if (!result) {
    res.status(404).json({ error: "Published ad not found." });
    return;
  }
  res.json(GetPublicAdResponse.parse(result));
});

publicRouter.post("/public/ads/:slug/events", async (req, res): Promise<void> => {
  const params = RecordPublicAdEventParams.safeParse(req.params);
  const body = RecordPublicAdEventBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message ?? "Invalid event." });
    return;
  }
  const [ad] = await db
    .select()
    .from(adsTable)
    .where(and(eq(adsTable.slug, params.data.slug), eq(adsTable.status, "published")))
    .limit(1);
  if (!ad) {
    res.status(404).json({ error: "Published ad not found." });
    return;
  }
  const metadata = body.data.metadata ?? {};
  const [event] = await db
    .insert(adEventsTable)
    .values({ adId: ad.id, eventType: body.data.eventType, metadata })
    .returning();
  if (body.data.eventType === "view") {
    await db.update(adsTable).set({ impressions: sql`${adsTable.impressions} + 1` }).where(eq(adsTable.id, ad.id));
  } else {
    await db.update(adsTable).set({ interactions: sql`${adsTable.interactions} + 1` }).where(eq(adsTable.id, ad.id));
  }
  res.status(201).json(RecordPublicAdEventResponse.parse(event));
});

publicRouter.post("/public/ads/:slug/leads", async (req, res): Promise<void> => {
  const params = SubmitPublicLeadParams.safeParse(req.params);
  const body = SubmitPublicLeadBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message ?? "Invalid lead." });
    return;
  }
  if (!body.data.consent) {
    res.status(400).json({ error: "Consent is required to submit this form." });
    return;
  }
  const [ad] = await db
    .select()
    .from(adsTable)
    .where(and(eq(adsTable.slug, params.data.slug), eq(adsTable.status, "published")))
    .limit(1);
  if (!ad) {
    res.status(404).json({ error: "Published ad not found." });
    return;
  }
  const [lead] = await db
    .insert(leadsTable)
    .values({
      brandId: ad.brandId,
      adId: ad.id,
      name: body.data.name,
      email: body.data.email,
      phone: body.data.phone ?? null,
      consent: body.data.consent,
    })
    .returning();
  await db.update(adsTable).set({ leads: sql`${adsTable.leads} + 1` }).where(eq(adsTable.id, ad.id));
  await db.insert(adEventsTable).values({
    adId: ad.id,
    eventType: "lead_submit",
    metadata: { source: "public_ad" },
  });
  res.status(201).json(SubmitPublicLeadResponse.parse(lead));
});

privateRouter.get("/brands", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const rows = await db
    .select()
    .from(brandsTable)
    .where(brandScope(actor, brandsTable))
    .orderBy(asc(brandsTable.name));
  res.json(ListBrandsResponse.parse(rows));
});

privateRouter.post("/brands", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const body = CreateBrandBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (actor.role !== "agency_admin") {
    res.status(403).json({ error: "Only agency admins can create brands." });
    return;
  }
  const [brand] = await db.insert(brandsTable).values(body.data).returning();
  await addActivity(brand.id, "created brand", brand.name);
  res.status(201).json(CreateBrandResponse.parse(brand));
});

privateRouter.patch("/brands/:brandId", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = UpdateBrandParams.safeParse(req.params);
  const body = UpdateBrandBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message ?? "Invalid brand update." });
    return;
  }
  if (!canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  if (actor.role !== "agency_admin") {
    res.status(403).json({ error: "Only agency admins can update brand details." });
    return;
  }
  const [brand] = await db
    .update(brandsTable)
    .set(body.data)
    .where(eq(brandsTable.id, params.data.brandId))
    .returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found." });
    return;
  }
  await addActivity(brand.id, "updated brand", brand.name);
  res.json(UpdateBrandResponse.parse(brand));
});

privateRouter.delete("/brands/:brandId", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = DeleteBrandParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (actor.role !== "agency_admin") {
    res.status(403).json({ error: "Only agency admins can delete brands." });
    return;
  }
  const [brand] = await db.delete(brandsTable).where(eq(brandsTable.id, params.data.brandId)).returning();
  if (!brand) {
    res.status(404).json({ error: "Brand not found." });
    return;
  }
  await addActivity(null, "deleted brand", brand.name);
  res.status(204).end();
  DeleteBrandResponse.parse(undefined);
});

privateRouter.get("/brands/:brandId/social-accounts", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = ListSocialAccountsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const rows = await db
    .select()
    .from(socialAccountsTable)
    .where(eq(socialAccountsTable.brandId, params.data.brandId))
    .orderBy(asc(socialAccountsTable.platform));
  res.json(ListSocialAccountsResponse.parse(rows));
});

privateRouter.post("/brands/:brandId/social-accounts", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = ListSocialAccountsParams.safeParse(req.params);
  const body = ConnectSocialAccountBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message ?? "Invalid account." });
    return;
  }
  if (!canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const [account] = await db
    .insert(socialAccountsTable)
    .values({
      brandId: params.data.brandId,
      platform: body.data.platform,
      handle: body.data.handle,
      status: "connected",
      followers: 1250 + (body.data.handle.length * 487) % 42800,
      lastSyncedAt: new Date(),
    })
    .returning();
  await addActivity(params.data.brandId, "connected social account", `${body.data.platform} · ${body.data.handle}`);
  res.status(201).json(ConnectSocialAccountResponse.parse(account));
});

privateRouter.delete("/social-accounts/:accountId", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = DisconnectSocialAccountParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [account] = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.id, params.data.accountId)).limit(1);
  if (!account) {
    res.status(404).json({ error: "Social account not found." });
    return;
  }
  if (!canAccessBrand(actor, account.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  await db.delete(socialAccountsTable).where(eq(socialAccountsTable.id, account.id));
  await addActivity(account.brandId, "disconnected social account", `${account.platform} · ${account.handle}`);
  res.status(204).end();
  DisconnectSocialAccountResponse.parse(undefined);
});

privateRouter.get("/ads", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = ListAdsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (params.data.brandId !== undefined && !canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const conditions: SQL[] = [];
  if (actor.role !== "agency_admin") {
    conditions.push(actor.brandIds.length ? inArray(adsTable.brandId, actor.brandIds) : sql`false`);
  }
  if (params.data.brandId !== undefined) conditions.push(eq(adsTable.brandId, params.data.brandId));
  if (params.data.status) conditions.push(eq(adsTable.status, params.data.status));
  if (params.data.search) {
    conditions.push(or(ilike(adsTable.name, `%${params.data.search}%`), ilike(adsTable.headline, `%${params.data.search}%`))!);
  }
  const rows = await db.select().from(adsTable).where(and(...conditions)).orderBy(desc(adsTable.updatedAt));
  res.json(ListAdsResponse.parse(rows));
});

privateRouter.post("/ads", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const body = CreateAdBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!canAccessBrand(actor, body.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const [ad] = await db.insert(adsTable).values(body.data).returning();
  await addActivity(ad.brandId, "created ad", ad.name);
  res.status(201).json(CreateAdResponse.parse(ad));
});

privateRouter.get("/ads/:adId", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = GetAdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [ad] = await db.select().from(adsTable).where(eq(adsTable.id, params.data.adId)).limit(1);
  if (!ad) {
    res.status(404).json({ error: "Ad not found." });
    return;
  }
  if (!canAccessBrand(actor, ad.brandId)) {
    res.status(403).json({ error: "You do not have access to this ad." });
    return;
  }
  res.json(GetAdResponse.parse(ad));
});

privateRouter.patch("/ads/:adId", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = UpdateAdParams.safeParse(req.params);
  const body = UpdateAdBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message ?? "Invalid ad update." });
    return;
  }
  const [current] = await db.select().from(adsTable).where(eq(adsTable.id, params.data.adId)).limit(1);
  if (!current) {
    res.status(404).json({ error: "Ad not found." });
    return;
  }
  if (!canAccessBrand(actor, current.brandId)) {
    res.status(403).json({ error: "You do not have access to this ad." });
    return;
  }
  const update: Partial<typeof adsTable.$inferInsert> = { ...body.data };
  if (body.data.status === "published" && current.status !== "published") {
    update.slug = current.slug ?? randomBytes(8).toString("hex");
    update.publishedAt = new Date();
  }
  const [ad] = await db.update(adsTable).set(update).where(eq(adsTable.id, current.id)).returning();
  await addActivity(ad.brandId, body.data.status === "published" ? "published ad" : "updated ad", ad.name);
  res.json(UpdateAdResponse.parse(ad));
});

privateRouter.delete("/ads/:adId", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = DeleteAdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [current] = await db.select().from(adsTable).where(eq(adsTable.id, params.data.adId)).limit(1);
  if (!current) {
    res.status(404).json({ error: "Ad not found." });
    return;
  }
  if (!canAccessBrand(actor, current.brandId)) {
    res.status(403).json({ error: "You do not have access to this ad." });
    return;
  }
  await db.delete(adsTable).where(eq(adsTable.id, current.id));
  await addActivity(current.brandId, "deleted ad", current.name);
  res.status(204).end();
  DeleteAdResponse.parse(undefined);
});

privateRouter.get("/scheduled-posts", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = ListScheduledPostsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .update(scheduledPostsTable)
    .set({ status: "published" })
    .where(and(eq(scheduledPostsTable.status, "scheduled"), lte(scheduledPostsTable.scheduledAt, new Date())));
  if (params.data.brandId !== undefined && !canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const conditions: SQL[] = [];
  if (actor.role !== "agency_admin") {
    conditions.push(actor.brandIds.length ? inArray(scheduledPostsTable.brandId, actor.brandIds) : sql`false`);
  }
  if (params.data.brandId !== undefined) conditions.push(eq(scheduledPostsTable.brandId, params.data.brandId));
  if (params.data.from) conditions.push(gte(scheduledPostsTable.scheduledAt, new Date(params.data.from)));
  if (params.data.to) conditions.push(lte(scheduledPostsTable.scheduledAt, new Date(params.data.to)));
  const rows = await db
    .select()
    .from(scheduledPostsTable)
    .where(and(...conditions))
    .orderBy(asc(scheduledPostsTable.scheduledAt));
  res.json(ListScheduledPostsResponse.parse(rows));
});

privateRouter.post("/scheduled-posts", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const body = CreateScheduledPostBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!canAccessBrand(actor, body.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const data = {
    ...body.data,
    scheduledAt: new Date(body.data.scheduledAt),
    status: body.data.status ?? "scheduled" as const,
  };
  const [post] = await db.insert(scheduledPostsTable).values(data).returning();
  await addActivity(post.brandId, "scheduled a post", post.caption.slice(0, 90) || "Social post");
  res.status(201).json(CreateScheduledPostResponse.parse(post));
});

privateRouter.patch("/scheduled-posts/:postId", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = UpdateScheduledPostParams.safeParse(req.params);
  const body = UpdateScheduledPostBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message ?? "Invalid post update." });
    return;
  }
  const [current] = await db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.id, params.data.postId)).limit(1);
  if (!current) {
    res.status(404).json({ error: "Scheduled post not found." });
    return;
  }
  if (!canAccessBrand(actor, current.brandId)) {
    res.status(403).json({ error: "You do not have access to this post." });
    return;
  }
  const update = {
    ...body.data,
    ...(body.data.scheduledAt ? { scheduledAt: new Date(body.data.scheduledAt) } : {}),
  };
  const [post] = await db.update(scheduledPostsTable).set(update).where(eq(scheduledPostsTable.id, current.id)).returning();
  await addActivity(post.brandId, "updated scheduled post", post.caption.slice(0, 90) || "Social post");
  res.json(UpdateScheduledPostResponse.parse(post));
});

privateRouter.delete("/scheduled-posts/:postId", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = DeleteScheduledPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [current] = await db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.id, params.data.postId)).limit(1);
  if (!current) {
    res.status(404).json({ error: "Scheduled post not found." });
    return;
  }
  if (!canAccessBrand(actor, current.brandId)) {
    res.status(403).json({ error: "You do not have access to this post." });
    return;
  }
  await db.delete(scheduledPostsTable).where(eq(scheduledPostsTable.id, current.id));
  res.status(204).end();
  DeleteScheduledPostResponse.parse(undefined);
});

privateRouter.get("/leads", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = ListLeadsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (params.data.brandId !== undefined && !canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const conditions: SQL[] = [];
  if (actor.role !== "agency_admin") {
    conditions.push(actor.brandIds.length ? inArray(leadsTable.brandId, actor.brandIds) : sql`false`);
  }
  if (params.data.brandId !== undefined) conditions.push(eq(leadsTable.brandId, params.data.brandId));
  if (params.data.search) {
    conditions.push(or(ilike(leadsTable.name, `%${params.data.search}%`), ilike(leadsTable.email, `%${params.data.search}%`))!);
  }
  const where = and(...conditions);
  const page = params.data.page ?? 1;
  const pageSize = params.data.pageSize ?? 10;
  const [totalResult] = await db.select({ value: count() }).from(leadsTable).where(where);
  const items = await db
    .select()
    .from(leadsTable)
    .where(where)
    .orderBy(desc(leadsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  res.json(ListLeadsResponse.parse({
    items,
    page,
    pageSize,
    total: totalResult.value,
    totalPages: Math.ceil(totalResult.value / pageSize),
  }));
});

privateRouter.get("/dashboard", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = GetDashboardQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (params.data.brandId !== undefined && !canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const adConditions: SQL[] = [];
  if (actor.role !== "agency_admin") {
    adConditions.push(actor.brandIds.length ? inArray(adsTable.brandId, actor.brandIds) : sql`false`);
  }
  if (params.data.brandId !== undefined) adConditions.push(eq(adsTable.brandId, params.data.brandId));
  const ads = await db.select().from(adsTable).where(and(...adConditions));
  const brandIds = params.data.brandId === undefined ? await visibleBrandIds(actor) : [params.data.brandId];
  const posts = brandIds.length
    ? await db.select({ id: scheduledPostsTable.id }).from(scheduledPostsTable).where(and(
      inArray(scheduledPostsTable.brandId, brandIds),
      eq(scheduledPostsTable.status, "scheduled"),
    ))
    : [];
  const impressions = ads.reduce((sum, ad) => sum + ad.impressions, 0);
  const interactions = ads.reduce((sum, ad) => sum + ad.interactions, 0);
  const leads = ads.reduce((sum, ad) => sum + ad.leads, 0);
  const adIds = ads.map((ad) => ad.id);
  const now = new Date();
  const periodStart = new Date(now.getTime() - 7 * 86400000);
  const previousStart = new Date(now.getTime() - 14 * 86400000);
  const events = adIds.length
    ? await db.select().from(adEventsTable).where(and(inArray(adEventsTable.adId, adIds), gte(adEventsTable.createdAt, previousStart)))
    : [];
  const currentEvents = events.filter((event) => event.createdAt >= periodStart);
  const previousEvents = events.filter((event) => event.createdAt < periodStart);
  const eventDelta = (kind: string): number => {
    const current = currentEvents.filter((event) => kind === "interactions" ? event.eventType !== "view" : event.eventType === "view").length;
    const previous = previousEvents.filter((event) => kind === "interactions" ? event.eventType !== "view" : event.eventType === "view").length;
    return previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  };
  res.json(GetDashboardResponse.parse({
    impressions,
    interactions,
    ctr: impressions ? (interactions / impressions) * 100 : 0,
    leads,
    conversionRate: interactions ? (leads / interactions) * 100 : 0,
    activeAds: ads.filter((ad) => ad.status === "published").length,
    scheduledPosts: posts.length,
    impressionsChange: eventDelta("impressions"),
    interactionsChange: eventDelta("interactions"),
  }));
});

privateRouter.get("/analytics", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = GetAnalyticsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (params.data.brandId !== undefined && !canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const days = params.data.range === "7d" ? 7 : params.data.range === "90d" ? 90 : 30;
  const scopedBrands = params.data.brandId === undefined ? await visibleBrandIds(actor) : [params.data.brandId];
  const scopedAds = scopedBrands.length
    ? await db.select().from(adsTable).where(inArray(adsTable.brandId, scopedBrands))
    : [];
  const adIds = scopedAds.map((ad) => ad.id);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const events = adIds.length
    ? await db.select().from(adEventsTable).where(and(inArray(adEventsTable.adId, adIds), gte(adEventsTable.createdAt, start)))
    : [];
  const buckets = new Map<string, { impressions: number; interactions: number; leads: number }>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    buckets.set(date.toISOString().slice(0, 10), { impressions: 0, interactions: 0, leads: 0 });
  }
  const platformTotals = new Map<string, { impressions: number; interactions: number }>();
  for (const event of events) {
    const dateKey = event.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(dateKey);
    if (bucket) {
      if (event.eventType === "view") bucket.impressions += 1;
      else bucket.interactions += 1;
      if (event.eventType === "lead_submit") bucket.leads += 1;
    }
    const rawPlatform = event.metadata.platform;
    if (typeof rawPlatform === "string" && platforms.includes(rawPlatform as (typeof platforms)[number])) {
      const current = platformTotals.get(rawPlatform) ?? { impressions: 0, interactions: 0 };
      if (event.eventType === "view") current.impressions += 1;
      else current.interactions += 1;
      platformTotals.set(rawPlatform, current);
    }
  }
  const topAds = scopedAds
    .map((ad) => ({
      id: ad.id,
      name: ad.name,
      type: ad.type,
      impressions: ad.impressions,
      interactions: ad.interactions,
      ctr: ad.impressions ? (ad.interactions / ad.impressions) * 100 : 0,
    }))
    .sort((a, b) => b.interactions - a.interactions)
    .slice(0, 8);
  const analytics = {
    series: [...buckets.entries()].map(([date, values]) => ({ date, ...values })),
    topAds,
    platforms: [...platformTotals.entries()].map(([platform, metrics]) => ({ platform, ...metrics })),
  };
  res.json(GetAnalyticsResponse.parse(analytics));
});

privateRouter.get("/activities", async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = ListActivitiesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (params.data.brandId !== undefined && !canAccessBrand(actor, params.data.brandId)) {
    res.status(403).json({ error: "You do not have access to this brand." });
    return;
  }
  const conditions: SQL[] = [];
  if (params.data.brandId !== undefined) conditions.push(eq(activitiesTable.brandId, params.data.brandId));
  else if (actor.role !== "agency_admin") {
    conditions.push(actor.brandIds.length ? inArray(activitiesTable.brandId, actor.brandIds) : sql`false`);
  }
  const rows = await db.select().from(activitiesTable).where(and(...conditions)).orderBy(desc(activitiesTable.createdAt)).limit(20);
  res.json(ListActivitiesResponse.parse(rows));
});

privateRouter.get("/team-members", requireAgencyAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(teamMembersTable).orderBy(asc(teamMembersTable.email));
  res.json(ListTeamMembersResponse.parse(rows));
});

privateRouter.post("/team-members", requireAgencyAdmin, async (req, res): Promise<void> => {
  const body = InviteTeamMemberBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [member] = await db
    .insert(teamMembersTable)
    .values({
      email: body.data.email.toLowerCase(),
      role: body.data.role,
      brandIds: body.data.brandIds,
      status: "invited",
    })
    .onConflictDoUpdate({
      target: teamMembersTable.email,
      set: { role: body.data.role, brandIds: body.data.brandIds, status: "invited", clerkUserId: null },
    })
    .returning();
  await addActivity(null, "invited a teammate", member.email);
  res.status(201).json(InviteTeamMemberResponse.parse(member));
});

privateRouter.patch("/team-members/:memberId", requireAgencyAdmin, async (req, res): Promise<void> => {
  const params = UpdateTeamMemberParams.safeParse(req.params);
  const body = UpdateTeamMemberBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message ?? "Invalid member update." });
    return;
  }
  if (body.data.brandIds) {
    const validBrands = await db.select({ id: brandsTable.id }).from(brandsTable).where(inArray(brandsTable.id, body.data.brandIds));
    if (validBrands.length !== body.data.brandIds.length) {
      res.status(400).json({ error: "One or more assigned brands do not exist." });
      return;
    }
  }
  const [member] = await db
    .update(teamMembersTable)
    .set(body.data)
    .where(eq(teamMembersTable.id, params.data.memberId))
    .returning();
  if (!member) {
    res.status(404).json({ error: "Team member not found." });
    return;
  }
  res.json(UpdateTeamMemberResponse.parse(member));
});

privateRouter.delete("/team-members/:memberId", requireAgencyAdmin, async (req, res): Promise<void> => {
  const actor = actorFor(res);
  const params = RemoveTeamMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, params.data.memberId)).limit(1);
  if (!member) {
    res.status(404).json({ error: "Team member not found." });
    return;
  }
  if (member.id === actor.id) {
    res.status(409).json({ error: "You cannot remove your own account." });
    return;
  }
  if (member.role === "agency_admin" && member.status === "active") {
    const [admins] = await db
      .select({ value: count() })
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.role, "agency_admin"), eq(teamMembersTable.status, "active")));
    if (admins.value <= 1) {
      res.status(409).json({ error: "The last agency admin cannot be removed." });
      return;
    }
  }
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, member.id));
  res.status(204).end();
  RemoveTeamMemberResponse.parse(undefined);
});

router.use(publicRouter);
router.use(attachActor, privateRouter);

export default router;
