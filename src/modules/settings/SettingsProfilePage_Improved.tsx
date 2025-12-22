// Improved SettingsProfilePage with form validation and confirmation
import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useOptimisticUpdate } from "@/hooks/useOptimisticUpdate";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getUserFriendlyErrorMessage } from "@/lib/errorHandling";
import { Save, AlertCircle, CheckCircle } from "lucide-react";

interface ProfileData {
    displayName: string;
    username: string;
    bio: string;
}

const SettingsProfilePage: React.FC = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState<ProfileData>({
        displayName: "",
        username: "",
        bio: "",
    });
    const [errors, setErrors] = useState<Partial<ProfileData>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Validation
    const validateForm = (): boolean => {
        const newErrors: Partial<ProfileData> = {};

        if (!formData.displayName.trim()) {
            newErrors.displayName = "Display name is required";
        } else if (formData.displayName.length > 50) {
            newErrors.displayName = "Display name must be 50 characters or less";
        }

        if (!formData.username.trim()) {
            newErrors.username = "Username is required";
        } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(formData.username)) {
            newErrors.username = "Username must be 3-20 characters (letters, numbers, underscores only)";
        }

        if (formData.bio.length > 500) {
            newErrors.bio = "Bio must be 500 characters or less";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Save profile
    const handleSave = async () => {
        if (!validateForm()) return;
        if (!user?.id) return;

        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            const { error } = await supabase
                .from("profiles")
                .update({
                    display_name: formData.displayName,
                    username: formData.username,
                    bio: formData.bio,
                })
                .eq("id", user.id);

            if (error) throw error;

            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            const message = getUserFriendlyErrorMessage(error);
            setSaveError(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

            <div className="space-y-6">
                {/* Display Name */}
                <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                        Display Name *
                    </label>
                    <input
                        type="text"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        className={`w-full px-4 py-2 rounded-lg border ${errors.displayName ? "border-red-500" : "border-border"
                            } bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary`}
                        placeholder="Your name"
                    />
                    {errors.displayName && (
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" aria-hidden />
                            {errors.displayName}
                        </p>
                    )}
                </div>

                {/* Username */}
                <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                        Username *
                    </label>
                    <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className={`w-full px-4 py-2 rounded-lg border ${errors.username ? "border-red-500" : "border-border"
                            } bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary`}
                        placeholder="username"
                    />
                    {errors.username && (
                        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" aria-hidden />
                            {errors.username}
                        </p>
                    )}
                </div>

                {/* Bio */}
                <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                        Bio
                    </label>
                    <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        rows={4}
                        className={`w-full px-4 py-2 rounded-lg border ${errors.bio ? "border-red-500" : "border-border"
                            } bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none`}
                        placeholder="Tell us about yourself..."
                    />
                    <div className="flex items-center justify-between mt-1">
                        {errors.bio && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" aria-hidden />
                                {errors.bio}
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground ml-auto">
                            {formData.bio.length}/500
                        </p>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" aria-hidden />
                        {isSaving ? "Saving..." : "Save Changes"}
                    </button>

                    {saveSuccess && (
                        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" aria-hidden />
                            Profile updated successfully!
                        </p>
                    )}
                </div>

                {/* Error Message */}
                {saveError && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" aria-hidden />
                            {saveError}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SettingsProfilePage;
