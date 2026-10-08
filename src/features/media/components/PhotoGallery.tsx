"use client";

import { Button, Flex, Image, Popconfirm, Tooltip, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";
import { PHOTO_LIMITS, type Photo, type PhotoOwner } from "../domain";
import { useEnsurePhoto, useObjectUrl, usePhotoActions, usePhotos } from "../hooks";

interface PhotoGalleryProps {
  ownerType: PhotoOwner;
  ownerId: string;
  /** Si puede subir, borrar y elegir portada. */
  editable: boolean;
  coverId?: string;
  onSetCover?: (photoId: string) => void;
  /** Al subir la primera foto (para usarla de portada). */
  onFirstPhoto?: (photoId: string) => void;
}

/** Galería: miniaturas que se abren en grande (con zoom y deslizar), subir fotos y elegir portada. */
export function PhotoGallery({ ownerType, ownerId, editable, coverId, onSetCover, onFirstPhoto }: PhotoGalleryProps) {
  const t = useT();
  const { token } = theme.useToken();
  const photos = usePhotos(ownerType, ownerId);
  const { add } = usePhotoActions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const full = (photos?.length ?? 0) >= PHOTO_LIMITS.maxPerOwner;

  async function upload(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    const hadPhotos = (photos?.length ?? 0) > 0;
    const ids = await add(ownerType, ownerId, files);
    setUploading(false);
    if (ids?.length && !hadPhotos) onFirstPhoto?.(ids[0]);
  }

  return (
    <div>
      {photos?.length === 0 && !editable && (
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          {t("media.empty")}
        </Typography.Paragraph>
      )}
      <Image.PreviewGroup>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 8 }}>
          <AnimatePresence initial={false}>
            {photos?.map((photo) => (
              <PhotoTile key={photo.id} photo={photo} editable={editable} isCover={photo.id === coverId} onSetCover={onSetCover} />
            ))}
          </AnimatePresence>
          {editable && !full && (
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              transition={SPRING.snappy}
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              style={{
                aspectRatio: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: token.borderRadiusLG,
                border: `1.5px dashed ${token.colorBorder}`,
                background: token.colorFillQuaternary,
                color: token.colorTextSecondary,
                cursor: uploading ? "progress" : "pointer",
                fontSize: token.fontSizeSM,
              }}
            >
              <span style={{ fontSize: token.fontSizeXL, display: "inline-flex" }}>
                <ImagePlus />
              </span>
              {uploading ? t("media.uploading") : t("media.add")}
            </motion.button>
          )}
        </div>
      </Image.PreviewGroup>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          upload(files);
        }}
      />
      {editable && (
        <Typography.Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: token.fontSizeSM }}>
          {t("media.hint", { max: PHOTO_LIMITS.maxPerOwner })}
        </Typography.Text>
      )}
    </div>
  );
}

function PhotoTile({ photo, editable, isCover, onSetCover }: { photo: Photo; editable: boolean; isCover: boolean; onSetCover?: (photoId: string) => void }) {
  const t = useT();
  const { token } = theme.useToken();
  // De otro dispositivo: la miniatura y la foto completa se bajan (cifradas) al mostrarla.
  useEnsurePhoto(photo, "thumb", "blob");
  const thumb = useObjectUrl(photo.thumb, `${photo.id}:thumb`);
  const full = useObjectUrl(photo.blob, `${photo.id}:blob`);
  const { remove } = usePhotoActions();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING.snappy}
      style={{ position: "relative", aspectRatio: "1", borderRadius: token.borderRadiusLG, overflow: "hidden", background: token.colorFillTertiary }}
    >
      {thumb && (
        <Image
          src={thumb}
          preview={{ src: full ?? thumb }}
          alt=""
          width="100%"
          height="100%"
          style={{ objectFit: "cover", aspectRatio: "1" }}
          rootClassName="od-photo-tile"
        />
      )}
      {(editable || isCover) && (
        <Flex gap={4} style={{ position: "absolute", top: 6, right: 6 }}>
          {editable && onSetCover ? (
            <Tooltip title={isCover ? t("media.isCover") : t("media.setCover")}>
              <Button
                size="small"
                shape="circle"
                aria-label={t("media.setCover")}
                aria-pressed={isCover}
                icon={<Star style={isCover ? { fill: token.colorWarning, color: token.colorWarning } : undefined} />}
                onClick={() => onSetCover(photo.id)}
              />
            </Tooltip>
          ) : (
            isCover && (
              <span style={{ display: "inline-flex", padding: 4, borderRadius: "50%", background: token.colorBgElevated }}>
                <Star style={{ fill: token.colorWarning, color: token.colorWarning }} />
              </span>
            )
          )}
          {editable && (
            <Popconfirm title={t("media.deleteConfirm")} okButtonProps={{ danger: true }} okText={t("inventory.list.deleteOk")} cancelText={t("common.cancel")} onConfirm={() => remove(photo.id)}>
              <Button size="small" shape="circle" danger aria-label={t("media.delete")} icon={<Trash2 />} />
            </Popconfirm>
          )}
        </Flex>
      )}
    </motion.div>
  );
}
