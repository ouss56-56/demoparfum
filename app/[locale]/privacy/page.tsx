import { useTranslations } from 'next-intl';

export default function PrivacyPage() {
    const t = useTranslations('common');
    return (
        <div className="max-w-4xl mx-auto px-6 py-20 min-h-screen">
            <h1 className="text-4xl font-serif mb-8">Privacy Policy</h1>
            <div className="prose prose-sm max-w-none text-gray-600">
                <p>Your privacy is important to us. This policy outlines how we handle your data.</p>
                <h3>Data Collection</h3>
                <p>We collect information necessary to process your wholesale orders and manage your account.</p>
                <h3>Security</h3>
                <p>We implement industry-standard security measures to protect your information.</p>
            </div>
        </div>
    );
}
