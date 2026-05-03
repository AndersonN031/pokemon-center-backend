-- CreateTable
CREATE TABLE "manhwas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cover" TEXT,
    "description" TEXT,
    "author" TEXT,
    "artist" TEXT,
    "status" TEXT,
    "genres" TEXT[],
    "rating" DOUBLE PRECISION,
    "views" INTEGER NOT NULL DEFAULT 0,
    "chapters" INTEGER,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manhwas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manhwa_chapters" (
    "id" TEXT NOT NULL,
    "manhwaId" TEXT NOT NULL,
    "number" DOUBLE PRECISION NOT NULL,
    "title" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "pages" TEXT[],
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manhwa_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraping_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manhwas_slug_key" ON "manhwas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "manhwas_sourceUrl_key" ON "manhwas"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "manhwa_chapters_manhwaId_number_key" ON "manhwa_chapters"("manhwaId", "number");

-- AddForeignKey
ALTER TABLE "manhwa_chapters" ADD CONSTRAINT "manhwa_chapters_manhwaId_fkey" FOREIGN KEY ("manhwaId") REFERENCES "manhwas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
