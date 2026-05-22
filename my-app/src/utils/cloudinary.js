const CLOUD_NAME = "durqaiei1";
const UPLOAD_PRESET = "streetassist_unsigned";
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

/**
 * Uploads an image or video file to Cloudinary using unsigned upload preset.
 * @param {File} file - The media file to upload
 * @returns {Promise<{ url: string, resourceType: string, publicId: string }>}
 */
export const uploadMediaToCloudinary = async (file) => {
  if (!file) throw new Error("No file provided");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  try {
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Failed to upload image");
    }

    const data = await response.json();
    return {
      url: data.secure_url,
      resourceType: data.resource_type || "image",
      publicId: data.public_id || "",
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};

export const uploadImageToCloudinary = async (file) => {
  const result = await uploadMediaToCloudinary(file);
  return result.url;
};
