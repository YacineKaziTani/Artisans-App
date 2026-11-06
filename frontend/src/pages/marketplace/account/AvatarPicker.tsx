import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUploadAvatar } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import { IMAGE_ACCEPT, IMAGE_TOO_LARGE_MESSAGE, isImageTooLarge } from "@/lib/uploads";
import type { User } from "@/types";
import { img } from "@/lib/images";

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Profile photo with an upload button (images go to the app's Cloudinary). */
export function AvatarPicker({ profile }: { profile: User }) {
  const upload = useUploadAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tooLarge, setTooLarge] = useState(false);

  return (
    <div className="flex items-center gap-4">
      {profile.avatarUrl ? (
        <img
          {...img(profile.avatarUrl, 64)}
          alt=""
          className="size-16 rounded-full border border-border object-cover"
        />
      ) : (
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
          {initialsOf(profile.name)}
        </span>
      )}
      <div className="space-y-1">
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            upload.reset();
            setTooLarge(isImageTooLarge(file));
            if (!isImageTooLarge(file)) upload.mutate(file);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? "Uploading…" : profile.avatarUrl ? "Change photo" : "Add a photo"}
        </Button>
        {tooLarge && <p className="text-xs text-destructive">{IMAGE_TOO_LARGE_MESSAGE}</p>}
        {upload.isError && (
          <p className="text-xs text-destructive">
            {getErrorMessage(upload.error, "Couldn't upload that photo.")}
          </p>
        )}
      </div>
    </div>
  );
}
