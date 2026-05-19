import { useTranslation } from 'react-i18next';
import type { TweetData } from '../../../lib/housing/useTweetFetch';

type Props = { data: TweetData };

export function HousingRegisterTweetPreview({ data }: Props) {
    const { t } = useTranslation();
    const title = t('housing.register.tweetPreview.title');
    return (
        <section className="housing-tweet-preview" aria-label={title}>
            <header className="housing-tweet-preview-header">
                <span className="housing-tweet-preview-title">{title}</span>
                <span className="housing-tweet-preview-author">
                    {data.author.name}{' '}
                    <span className="housing-tweet-preview-handle">@{data.author.screen_name}</span>
                </span>
            </header>
            <p className="housing-tweet-preview-text">{data.text}</p>
            {data.photos.length > 0 && (
                <div className="housing-tweet-preview-photos">
                    {data.photos.map((url) => (
                        <img key={url} src={url} alt="" className="housing-tweet-preview-photo" />
                    ))}
                </div>
            )}
        </section>
    );
}
