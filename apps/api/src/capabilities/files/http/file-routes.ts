import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { z } from "zod";
import { idSchema, listResponseSchema, submissionFileSchema } from "@nethack/contracts";
import type { CapabilityContext } from "../../../core/capability.js";
import { NotFoundError, PayloadTooLargeError, ValidationError } from "../../../core/errors.js";
import { AuthGuard } from "../../../http/guards.js";
import { setPrivateNoStore, setPublicCache } from "../../../http/pagination.js";
import type { NethackServer } from "../../../http/types.js";
import type { FileService } from "../application/file-service.js";
import { contentDispositionFor, MAX_UPLOAD_BYTES } from "../domain/file-inspector.js";

const projectParams = z.object({ projectId: idSchema });
const fileParams = z.object({ fileId: idSchema });

export async function registerFileRoutes(
    app: NethackServer,
    context: CapabilityContext,
    service: FileService,
): Promise<void> {
    const guard = new AuthGuard(context.config, context.auth.sessions, context.auth.bearer);

    app.post(
        "/api/v1/projects/:projectId/files",
        {
            schema: {
                params: projectParams,
                response: { 201: submissionFileSchema },
            },
        },
        async (request, reply) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            await service.authorizeUpload(
                access.organizationId,
                request.params.projectId,
                auth.user.id,
                access.role,
            );
            if (!request.isMultipart()) {
                throw new ValidationError("A multipart/form-data upload is required.");
            }
            const part = await request.file();
            if (part === undefined) {
                throw new ValidationError("A file is required.");
            }
            const maxBytes = Math.min(context.config.storage.maxUploadBytes, MAX_UPLOAD_BYTES);
            const hash = createHash("sha256");
            const chunks: Buffer[] = [];
            let total = 0;
            const stream: AsyncIterable<Buffer | string> = part.file;
            try {
                for await (const chunk of stream) {
                    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
                    total += buffer.length;
                    if (total > maxBytes) {
                        throw new PayloadTooLargeError("The uploaded file exceeds the size limit.");
                    }
                    hash.update(buffer);
                    chunks.push(buffer);
                }
            } catch (error) {
                if (isFileTooLarge(error) || part.file.truncated) {
                    throw new PayloadTooLargeError("The uploaded file exceeds the size limit.");
                }
                throw error;
            }
            if (part.file.truncated) {
                throw new PayloadTooLargeError("The uploaded file exceeds the size limit.");
            }
            const file = await service.upload({
                organizationId: access.organizationId,
                projectId: request.params.projectId,
                userId: auth.user.id,
                organizationRole: access.role,
                buffer: Buffer.concat(chunks),
                fileName: part.filename,
                checksumSha256: hash.digest("hex"),
                maxBytes,
                ip: request.ip,
            });
            return reply.status(201).send(file);
        },
    );

    app.get(
        "/api/v1/projects/:projectId/files",
        {
            schema: {
                params: projectParams,
                response: { 200: listResponseSchema(submissionFileSchema) },
            },
        },
        async (request) => {
            const auth = await guard.require(request);
            const access = await guard.requireOrganization(request, auth);
            const items = await service.list(
                auth,
                access.organizationId,
                access.role,
                request.params.projectId,
            );
            return { items: [...items], nextCursor: null };
        },
    );

    app.get(
        "/api/v1/files/:fileId/download",
        { schema: { params: fileParams } },
        async (request, reply) => {
            const auth = await guard.resolve(request);
            const resolution = await service.resolveDownload(auth, request.params.fileId);
            const file = resolution.file;
            if (!(await context.storage.exists(file.storageKey))) {
                throw new NotFoundError("The file is not available.");
            }
            reply.header("content-disposition", contentDispositionFor(file.fileName));
            reply.header("content-type", file.contentType);
            reply.header("x-content-type-options", "nosniff");
            reply.header("content-security-policy", "sandbox");
            if (resolution.visibility === "public") {
                setPublicCache(reply, 300);
            } else {
                setPrivateNoStore(reply);
            }
            return reply.send(createReadStream(context.storage.approvedPath(file.storageKey)));
        },
    );

    app.delete(
        "/api/v1/files/:fileId",
        { schema: { params: fileParams } },
        async (request, reply) => {
            const auth = await guard.require(request);
            await service.delete(auth, request.params.fileId, request.ip);
            return reply.status(204).send();
        },
    );
}

function isFileTooLarge(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "FST_REQ_FILE_TOO_LARGE"
    );
}
