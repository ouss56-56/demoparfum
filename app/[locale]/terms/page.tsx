import { useTranslations } from 'next-intl';

export default function TermsPage() {
    const t = useTranslations('common');
    return (
        <div className="max-w-4xl mx-auto px-6 py-20 min-h-screen">
            <h1 className="text-4xl font-serif mb-8">Terms of Service</h1>
            <div className="prose prose-sm max-w-none text-gray-600">
                <p>By using this platform, you agree to our wholesale terms and conditions.</p>
                <h3>B2B Wholesale</h3>
                <p>Prices and inventory are subject to change without notice. All transactions are B2B.</p>
                <h3>Account Responsibility</h3>
                <p>Users are responsible for maintaining the confidentiality of their account credentials.</p>
            </div>
        </div>
    );
}
