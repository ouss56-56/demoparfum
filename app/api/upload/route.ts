import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const fileExt = file.name.split(".").pop() || "png";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const uploadDir = path.join(process.cwd(), "public", "products");
        const filePath = path.join(uploadDir, fileName);

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });

        // Securely write file to the local directory
        await writeFile(filePath, Buffer.from(buffer));

        // Get public URL (relative for Next.js)
        const publicUrl = `/products/${fileName}`;

        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
