import { Router, Request, Response } from "express";
import { Expo } from "expo-server-sdk";
import { authenticateToken } from "../middlewares/auth";
import prisma from "../lib/prisma";

const expo = new Expo();

const router = Router();

router.use(authenticateToken);

router.post("/start", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { targetUserId } = req.body;

  if (!targetUserId || typeof targetUserId !== "string") {
    res.status(400).json({ success: false, message: "targetUserId gereklidir." });
    return;
  }

  if (targetUserId === userId) {
    res.status(400).json({ success: false, message: "Kendinize mesaj atamazsınız." });
    return;
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) {
    res.status(404).json({ success: false, message: "Hedef kullanıcı bulunamadı." });
    return;
  }

  const block = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: userId },
      ],
    },
  });

  if (block) {
    res.status(403).json({ success: false, message: "Bu kullaniciyla sohbet baslatilamaz." });
    return;
  }

  const [u1, u2] = [userId, targetUserId].sort();

  let conversation = await prisma.conversation.findUnique({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    include: {
      user1: { select: { id: true, email: true, plates: { select: { plateNumber: true } } } },
      user2: { select: { id: true, email: true, plates: { select: { plateNumber: true } } } },
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { user1Id: u1, user2Id: u2 },
      include: {
        user1: { select: { id: true, email: true, plates: { select: { plateNumber: true } } } },
        user2: { select: { id: true, email: true, plates: { select: { plateNumber: true } } } },
      },
    });
  }

  res.json({ success: true, conversation });
});

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const blocks = await prisma.blockedUser.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });

  const blockedUserIds = new Set<string>();
  for (const b of blocks) {
    blockedUserIds.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: {
      user1: { select: { id: true, email: true, plates: { select: { plateNumber: true } } } },
      user2: { select: { id: true, email: true, plates: { select: { plateNumber: true } } } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const filtered = conversations.filter((c) => {
    const otherId = c.user1Id === userId ? c.user2Id : c.user1Id;
    return !blockedUserIds.has(otherId);
  });

  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: filtered.map((c) => c.id) },
      senderId: { not: userId },
      isRead: false,
    },
    _count: { id: true },
  });

  const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count.id]));

  const result = filtered.map((c) => ({
    ...c,
    unreadCount: unreadMap.get(c.id) ?? 0,
  }));

  res.json({ success: true, conversations: result });
});

router.get("/:id/messages", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const conversationId = req.params.id as string;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    res.status(404).json({ success: false, message: "Sohbet bulunamadı." });
    return;
  }

  if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
    res.status(403).json({ success: false, message: "Bu sohbete erişim yetkiniz yok." });
    return;
  }

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, email: true } },
    },
  });

  res.json({ success: true, messages });
});

router.post("/:id/messages", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const conversationId = req.params.id as string;
  const { content } = req.body;

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ success: false, message: "Mesaj içeriği boş olamaz." });
    return;
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    res.status(404).json({ success: false, message: "Sohbet bulunamadı." });
    return;
  }

  if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
    res.status(403).json({ success: false, message: "Bu sohbete mesaj gönderme yetkiniz yok." });
    return;
  }

  const recipientIdForBlock = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
  const blockExists = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: recipientIdForBlock },
        { blockerId: recipientIdForBlock, blockedId: userId },
      ],
    },
  });

  if (blockExists) {
    res.status(403).json({ success: false, message: "Bu kullaniciya mesaj gonderilemez." });
    return;
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      content: content.trim(),
    },
    include: {
      sender: { select: { id: true, email: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const recipientId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;
  const [recipient, sender] = await Promise.all([
    prisma.user.findUnique({
      where: { id: recipientId },
      select: { expoPushToken: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { plates: { select: { plateNumber: true }, take: 1 } },
    }),
  ]);

  if (recipient?.expoPushToken && Expo.isExpoPushToken(recipient.expoPushToken)) {
    const senderPlate = sender?.plates[0]?.plateNumber ?? "Birisi";
    const preview = content.trim().length > 50 ? content.trim().slice(0, 50) + "..." : content.trim();
    try {
      await expo.sendPushNotificationsAsync([
        {
          to: recipient.expoPushToken,
          sound: "default",
          title: `${senderPlate} - Yeni Mesaj`,
          body: preview,
          data: { conversationId },
        },
      ]);
    } catch {
      // Push gönderilemezse mesaj akışını engelleme
    }
  }

  res.status(201).json({ success: true, message });
});

export default router;
