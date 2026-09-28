-- =============================================
-- RMS Platform - Complete PostgreSQL Migration
-- Generated from Prisma schema (full rebuild)
-- =============================================
-- This migration creates ALL enums, tables,
-- indexes, unique constraints, and foreign keys.
-- Safe to run on a fresh database.
-- =============================================

-- ===========================================
-- ENUMS
-- ===========================================

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'REALTOR', 'CLIENT', 'STAFF');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'LAND', 'MIXED_USE', 'APARTMENT', 'CONDO', 'TOWNHOUSE', 'VILLA');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'SOLD', 'PENDING', 'LISTED', 'OFF_MARKET', 'UNDER_CONTRACT');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING');

-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SALE', 'COMMISSION', 'PROPERTY', 'RANKING', 'LOYALTY', 'SYSTEM', 'CHAT', 'PRICE_CHANGE', 'LISTING', 'OFFER', 'AWARD', 'LEAVE_REQUEST', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'TASK_ASSIGNED', 'TASK_COMPLETED', 'REVIEW_SCHEDULED', 'REVIEW_COMPLETED', 'MENTION', 'CHANNEL_INVITE', 'PAYROLL_PROCESSED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'PROPERTY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'DEED', 'INSPECTION', 'APPRAISAL', 'TITLE', 'TAX', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SALE', 'PURCHASE', 'COMMISSION', 'TAX', 'BONUS', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RankingPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AwardType" AS ENUM ('STAFF_OF_MONTH', 'REALTOR_OF_MONTH', 'CLIENT_OF_MONTH');

-- CreateEnum
CREATE TYPE "PaymentPlan" AS ENUM ('FULL', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('EXECUTIVE', 'DIRECTOR', 'MANAGER', 'TEAM_LEAD', 'SENIOR', 'JUNIOR', 'INTERN');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'COMPASSIONATE', 'UNPAID', 'STUDY');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewCycle" AS ENUM ('QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('DEPARTMENT', 'PROJECT', 'ANNOUNCEMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED');

-- ===========================================
-- TABLES
-- ===========================================

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: admin_profiles
CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: realtor_profiles
CREATE TABLE "realtor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "agency" TEXT,
    "bio" TEXT,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "totalSalesValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalCommission" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalTaxPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "loyaltyTier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "currentRank" INTEGER NOT NULL DEFAULT 0,
    "isRealtorOfMonth" BOOLEAN NOT NULL DEFAULT false,
    "isRealtorOfYear" BOOLEAN NOT NULL DEFAULT false,
    "realtorOfMonthCount" INTEGER NOT NULL DEFAULT 0,
    "realtorOfYearCount" INTEGER NOT NULL DEFAULT 0,
    "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "realtor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: client_profiles
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realtorId" TEXT,
    "totalPurchaseValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPropertyValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: properties
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "price" DECIMAL(15,2) NOT NULL,
    "originalPrice" DECIMAL(15,2) NOT NULL,
    "listingPrice" DECIMAL(15,2),
    "pricePerSqm" DECIMAL(15,2),
    "numberOfPlots" INTEGER,
    "appreciationPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "area" DOUBLE PRECISION NOT NULL,
    "lotSize" DOUBLE PRECISION,
    "yearBuilt" INTEGER,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "virtualTourUrl" TEXT,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "listedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "realtorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sales
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "salePrice" DECIMAL(15,2) NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DECIMAL(15,2) NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "netAmount" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "closingDate" TIMESTAMP(3),
    "paymentPlan" "PaymentPlan" NOT NULL DEFAULT 'FULL',
    "numberOfInstallments" INTEGER NOT NULL DEFAULT 1,
    "totalPaid" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remainingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "nextPaymentDue" TIMESTAMP(3),
    "areaSold" DOUBLE PRECISION,
    "loyaltyPointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable: commissions
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: taxes
CREATE TABLE "taxes" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: loyalty_points
CREATE TABLE "loyalty_points" (
    "id" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "saleId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rankings
CREATE TABLE "rankings" (
    "id" TEXT NOT NULL,
    "realtorId" TEXT NOT NULL,
    "period" "RankingPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalSales" INTEGER NOT NULL,
    "totalValue" DECIMAL(15,2) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rankings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payments
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "commissionAmount" DECIMAL(15,2) NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "netCommission" DECIMAL(15,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "paymentMethod" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: monthly_awards
CREATE TABLE "monthly_awards" (
    "id" TEXT NOT NULL,
    "type" "AwardType" NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable: offers
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "counterAmount" DECIMAL(15,2),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chat_rooms
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'DIRECT',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable: messages
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "attachments" JSONB,
    "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: documents
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transactions
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "referenceId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: price_history
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "oldPrice" DECIMAL(15,2) NOT NULL,
    "newPrice" DECIMAL(15,2) NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable: system_settings
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- ===========================================
-- STAFF & HR TABLES
-- ===========================================

-- CreateTable: departments
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: staff_profiles
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "position" "StaffPosition" NOT NULL,
    "title" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT NOT NULL,
    "managerId" TEXT,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "annualLeaveBalance" INTEGER NOT NULL DEFAULT 20,
    "sickLeaveBalance" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: staff_permissions
CREATE TABLE "staff_permissions" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: attendance
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL,
    "hoursWorked" DOUBLE PRECISION,
    "overtime" DOUBLE PRECISION DEFAULT 0,
    "notes" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable: leave_requests
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: performance_reviews
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "cycle" "ReviewCycle" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "overallRating" DOUBLE PRECISION,
    "ratings" JSONB,
    "strengths" TEXT,
    "areasForImprovement" TEXT,
    "goals" JSONB,
    "reviewerComments" TEXT,
    "revieweeComments" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_records
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "payDate" DATE,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "overtime" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "allowances" JSONB,
    "grossPay" DECIMAL(15,2) NOT NULL,
    "tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pension" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherDeductions" JSONB,
    "totalDeductions" DECIMAL(15,2) NOT NULL,
    "netPay" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable: staff_tasks
CREATE TABLE "staff_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT NOT NULL,
    "creatorId" TEXT,
    "createdByUserId" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propertyId" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_comments
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: team_channels
CREATE TABLE "team_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChannelType" NOT NULL,
    "departmentId" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: channel_members
CREATE TABLE "channel_members" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable: channel_messages
CREATE TABLE "channel_messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mentions
CREATE TABLE "mentions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: message_reactions
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: shared_files
CREATE TABLE "shared_files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "channelId" TEXT,
    "departmentId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "accessList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_files_pkey" PRIMARY KEY ("id")
);

-- ===========================================
-- IMPLICIT MANY-TO-MANY JOIN TABLE
-- ===========================================

-- CreateTable: _ChatParticipants (implicit m2m for User <-> ChatRoom)
CREATE TABLE "_ChatParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- ===========================================
-- UNIQUE CONSTRAINTS
-- ===========================================

-- users
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- admin_profiles
CREATE UNIQUE INDEX "admin_profiles_userId_key" ON "admin_profiles"("userId");

-- realtor_profiles
CREATE UNIQUE INDEX "realtor_profiles_userId_key" ON "realtor_profiles"("userId");
CREATE UNIQUE INDEX "realtor_profiles_licenseNumber_key" ON "realtor_profiles"("licenseNumber");

-- client_profiles
CREATE UNIQUE INDEX "client_profiles_userId_key" ON "client_profiles"("userId");

-- commissions
CREATE UNIQUE INDEX "commissions_saleId_key" ON "commissions"("saleId");

-- taxes
CREATE UNIQUE INDEX "taxes_saleId_key" ON "taxes"("saleId");

-- loyalty_points
CREATE UNIQUE INDEX "loyalty_points_saleId_key" ON "loyalty_points"("saleId");

-- rankings
CREATE UNIQUE INDEX "rankings_realtorId_period_periodStart_key" ON "rankings"("realtorId", "period", "periodStart");

-- monthly_awards
CREATE UNIQUE INDEX "monthly_awards_type_month_year_key" ON "monthly_awards"("type", "month", "year");

-- refresh_tokens
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- system_settings
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- transactions
CREATE UNIQUE INDEX "transactions_referenceId_key" ON "transactions"("referenceId");

-- departments
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
CREATE UNIQUE INDEX "departments_headId_key" ON "departments"("headId");

-- staff_profiles
CREATE UNIQUE INDEX "staff_profiles_userId_key" ON "staff_profiles"("userId");
CREATE UNIQUE INDEX "staff_profiles_employeeId_key" ON "staff_profiles"("employeeId");

-- staff_permissions
CREATE UNIQUE INDEX "staff_permissions_staffProfileId_resource_action_key" ON "staff_permissions"("staffProfileId", "resource", "action");

-- attendance
CREATE UNIQUE INDEX "attendance_staffProfileId_date_key" ON "attendance"("staffProfileId", "date");

-- payroll_records
CREATE UNIQUE INDEX "payroll_records_staffProfileId_periodStart_periodEnd_key" ON "payroll_records"("staffProfileId", "periodStart", "periodEnd");

-- channel_members
CREATE UNIQUE INDEX "channel_members_channelId_staffProfileId_key" ON "channel_members"("channelId", "staffProfileId");

-- mentions
CREATE UNIQUE INDEX "mentions_messageId_staffProfileId_key" ON "mentions"("messageId", "staffProfileId");

-- message_reactions
CREATE UNIQUE INDEX "message_reactions_messageId_userId_emoji_key" ON "message_reactions"("messageId", "userId", "emoji");

-- _ChatParticipants
CREATE UNIQUE INDEX "_ChatParticipants_AB_unique" ON "_ChatParticipants"("A", "B");

-- ===========================================
-- INDEXES
-- ===========================================

-- users
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_status_idx" ON "users"("status");

-- realtor_profiles
CREATE INDEX "realtor_profiles_licenseNumber_idx" ON "realtor_profiles"("licenseNumber");
CREATE INDEX "realtor_profiles_loyaltyTier_idx" ON "realtor_profiles"("loyaltyTier");
CREATE INDEX "realtor_profiles_currentRank_idx" ON "realtor_profiles"("currentRank");

-- client_profiles
CREATE INDEX "client_profiles_realtorId_idx" ON "client_profiles"("realtorId");

-- properties
CREATE INDEX "properties_status_idx" ON "properties"("status");
CREATE INDEX "properties_type_idx" ON "properties"("type");
CREATE INDEX "properties_city_idx" ON "properties"("city");
CREATE INDEX "properties_price_idx" ON "properties"("price");
CREATE INDEX "properties_isListed_idx" ON "properties"("isListed");

-- sales
CREATE INDEX "sales_realtorId_idx" ON "sales"("realtorId");
CREATE INDEX "sales_clientId_idx" ON "sales"("clientId");
CREATE INDEX "sales_status_idx" ON "sales"("status");
CREATE INDEX "sales_saleDate_idx" ON "sales"("saleDate");

-- commissions
CREATE INDEX "commissions_realtorId_idx" ON "commissions"("realtorId");
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- taxes
CREATE INDEX "taxes_realtorId_idx" ON "taxes"("realtorId");
CREATE INDEX "taxes_year_idx" ON "taxes"("year");

-- loyalty_points
CREATE INDEX "loyalty_points_realtorId_idx" ON "loyalty_points"("realtorId");
CREATE INDEX "loyalty_points_source_idx" ON "loyalty_points"("source");

-- rankings
CREATE INDEX "rankings_period_idx" ON "rankings"("period");
CREATE INDEX "rankings_rank_idx" ON "rankings"("rank");

-- payments
CREATE INDEX "payments_saleId_idx" ON "payments"("saleId");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_paymentDate_idx" ON "payments"("paymentDate");

-- monthly_awards
CREATE INDEX "monthly_awards_userId_idx" ON "monthly_awards"("userId");
CREATE INDEX "monthly_awards_type_idx" ON "monthly_awards"("type");
CREATE INDEX "monthly_awards_isPublished_idx" ON "monthly_awards"("isPublished");

-- offers
CREATE INDEX "offers_propertyId_idx" ON "offers"("propertyId");
CREATE INDEX "offers_buyerId_idx" ON "offers"("buyerId");
CREATE INDEX "offers_status_idx" ON "offers"("status");

-- messages
CREATE INDEX "messages_roomId_idx" ON "messages"("roomId");
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- notifications
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- documents
CREATE INDEX "documents_propertyId_idx" ON "documents"("propertyId");
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- transactions
CREATE INDEX "transactions_type_idx" ON "transactions"("type");
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
CREATE INDEX "transactions_fromUserId_idx" ON "transactions"("fromUserId");
CREATE INDEX "transactions_toUserId_idx" ON "transactions"("toUserId");

-- price_history
CREATE INDEX "price_history_propertyId_idx" ON "price_history"("propertyId");

-- audit_logs
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- refresh_tokens
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- departments
CREATE INDEX "departments_parentId_idx" ON "departments"("parentId");

-- staff_profiles
CREATE INDEX "staff_profiles_departmentId_idx" ON "staff_profiles"("departmentId");
CREATE INDEX "staff_profiles_managerId_idx" ON "staff_profiles"("managerId");
CREATE INDEX "staff_profiles_employeeId_idx" ON "staff_profiles"("employeeId");

-- staff_permissions
CREATE INDEX "staff_permissions_staffProfileId_idx" ON "staff_permissions"("staffProfileId");

-- attendance
CREATE INDEX "attendance_staffProfileId_idx" ON "attendance"("staffProfileId");
CREATE INDEX "attendance_date_idx" ON "attendance"("date");
CREATE INDEX "attendance_status_idx" ON "attendance"("status");

-- leave_requests
CREATE INDEX "leave_requests_staffProfileId_idx" ON "leave_requests"("staffProfileId");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");
CREATE INDEX "leave_requests_startDate_idx" ON "leave_requests"("startDate");

-- performance_reviews
CREATE INDEX "performance_reviews_revieweeId_idx" ON "performance_reviews"("revieweeId");
CREATE INDEX "performance_reviews_reviewerId_idx" ON "performance_reviews"("reviewerId");
CREATE INDEX "performance_reviews_status_idx" ON "performance_reviews"("status");

-- payroll_records
CREATE INDEX "payroll_records_staffProfileId_idx" ON "payroll_records"("staffProfileId");
CREATE INDEX "payroll_records_status_idx" ON "payroll_records"("status");

-- staff_tasks
CREATE INDEX "staff_tasks_assigneeId_idx" ON "staff_tasks"("assigneeId");
CREATE INDEX "staff_tasks_creatorId_idx" ON "staff_tasks"("creatorId");
CREATE INDEX "staff_tasks_status_idx" ON "staff_tasks"("status");
CREATE INDEX "staff_tasks_dueDate_idx" ON "staff_tasks"("dueDate");

-- task_comments
CREATE INDEX "task_comments_taskId_idx" ON "task_comments"("taskId");

-- team_channels
CREATE INDEX "team_channels_departmentId_idx" ON "team_channels"("departmentId");
CREATE INDEX "team_channels_type_idx" ON "team_channels"("type");

-- channel_members
CREATE INDEX "channel_members_channelId_idx" ON "channel_members"("channelId");
CREATE INDEX "channel_members_staffProfileId_idx" ON "channel_members"("staffProfileId");

-- channel_messages
CREATE INDEX "channel_messages_channelId_idx" ON "channel_messages"("channelId");
CREATE INDEX "channel_messages_senderId_idx" ON "channel_messages"("senderId");
CREATE INDEX "channel_messages_parentId_idx" ON "channel_messages"("parentId");

-- mentions
CREATE INDEX "mentions_staffProfileId_idx" ON "mentions"("staffProfileId");

-- message_reactions
CREATE INDEX "message_reactions_messageId_idx" ON "message_reactions"("messageId");

-- shared_files
CREATE INDEX "shared_files_channelId_idx" ON "shared_files"("channelId");
CREATE INDEX "shared_files_departmentId_idx" ON "shared_files"("departmentId");

-- _ChatParticipants
CREATE INDEX "_ChatParticipants_B_index" ON "_ChatParticipants"("B");

-- ===========================================
-- FOREIGN KEYS
-- ===========================================

-- admin_profiles -> users
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- realtor_profiles -> users
ALTER TABLE "realtor_profiles" ADD CONSTRAINT "realtor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- client_profiles -> users
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- client_profiles -> realtor_profiles
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- properties -> client_profiles (owner)
ALTER TABLE "properties" ADD CONSTRAINT "properties_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "client_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- properties -> realtor_profiles
ALTER TABLE "properties" ADD CONSTRAINT "properties_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- sales -> properties
ALTER TABLE "sales" ADD CONSTRAINT "sales_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- sales -> realtor_profiles
ALTER TABLE "sales" ADD CONSTRAINT "sales_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- sales -> client_profiles
ALTER TABLE "sales" ADD CONSTRAINT "sales_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- commissions -> sales
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- commissions -> realtor_profiles
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- taxes -> sales
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- taxes -> realtor_profiles
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- loyalty_points -> realtor_profiles
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- loyalty_points -> sales
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- rankings -> realtor_profiles
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_realtorId_fkey" FOREIGN KEY ("realtorId") REFERENCES "realtor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- payments -> sales
ALTER TABLE "payments" ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- monthly_awards -> users
ALTER TABLE "monthly_awards" ADD CONSTRAINT "monthly_awards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- offers -> properties
ALTER TABLE "offers" ADD CONSTRAINT "offers_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- offers -> client_profiles (buyer)
ALTER TABLE "offers" ADD CONSTRAINT "offers_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- messages -> chat_rooms
ALTER TABLE "messages" ADD CONSTRAINT "messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- messages -> users (sender)
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- notifications -> users
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- documents -> properties
ALTER TABLE "documents" ADD CONSTRAINT "documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- transactions -> sales (via referenceId)
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- price_history -> properties
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- audit_logs -> users
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- refresh_tokens -> users
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- departments -> departments (self-referential hierarchy)
ALTER TABLE "departments" ADD CONSTRAINT "departments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- departments -> staff_profiles (head)
ALTER TABLE "departments" ADD CONSTRAINT "departments_headId_fkey" FOREIGN KEY ("headId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- staff_profiles -> users
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- staff_profiles -> departments
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- staff_profiles -> staff_profiles (self-referential manager hierarchy)
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- staff_permissions -> staff_profiles
ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- attendance -> staff_profiles
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- leave_requests -> staff_profiles
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- performance_reviews -> staff_profiles (reviewee)
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- performance_reviews -> staff_profiles (reviewer)
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- payroll_records -> staff_profiles
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- staff_tasks -> staff_profiles (assignee)
ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- staff_tasks -> staff_profiles (creator, optional for admin users)
ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- task_comments -> staff_tasks
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "staff_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- team_channels -> departments
ALTER TABLE "team_channels" ADD CONSTRAINT "team_channels_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- channel_members -> team_channels
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_members -> staff_profiles
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_messages -> team_channels
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "team_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- channel_messages -> channel_messages (self-referential thread)
ALTER TABLE "channel_messages" ADD CONSTRAINT "channel_messages_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "channel_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- mentions -> channel_messages
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- mentions -> staff_profiles
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- message_reactions -> channel_messages
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "channel_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- _ChatParticipants -> chat_rooms (A)
ALTER TABLE "_ChatParticipants" ADD CONSTRAINT "_ChatParticipants_A_fkey" FOREIGN KEY ("A") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- _ChatParticipants -> users (B)
ALTER TABLE "_ChatParticipants" ADD CONSTRAINT "_ChatParticipants_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
