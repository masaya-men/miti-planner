// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

const mockFetchTweet = vi.fn();
const mockCancel = vi.fn();
const mockReset = vi.fn();
// useTweetFetch の戻り値はテストごとに差し替えられるよう可変にする
let tweetState: any = {
    status: 'idle',
    data: null,
    errorCode: null,
    fetchTweet: mockFetchTweet,
    cancel: mockCancel,
    reset: mockReset,
};
vi.mock('../../lib/housing/useTweetFetch', () => ({
    useTweetFetch: () => tweetState,
}));

import { HousingRegisterSnsUrlField } from '../../components/housing/register/HousingRegisterSnsUrlField';

describe('HousingRegisterSnsUrlField', () => {
    beforeEach(() => {
        mockFetchTweet.mockClear();
        mockCancel.mockClear();
        mockReset.mockClear();
        tweetState = {
            status: 'idle',
            data: null,
            errorCode: null,
            fetchTweet: mockFetchTweet,
            cancel: mockCancel,
            reset: mockReset,
        };
    });

    it('renders input field with label', () => {
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={() => {}} />);
        expect(screen.getByLabelText('housing.register.snsUrl.label')).toBeInTheDocument();
    });

    it('triggers fetchTweet on valid X URL paste', () => {
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={() => {}} />);
        const input = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(input, { target: { value: 'https://x.com/user/status/1842217368673759498' } });
        expect(mockFetchTweet).toHaveBeenCalledWith('1842217368673759498');
    });

    it('shows error key for invalid URL', () => {
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={() => {}} />);
        const input = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(input, { target: { value: 'https://example.com/foo' } });
        expect(screen.getByText('housing.register.snsUrl.error.invalid')).toBeInTheDocument();
        expect(mockFetchTweet).not.toHaveBeenCalled();
    });

    it('detects YouTube URL (youtu.be 形式) and calls onYoutubeFetched', () => {
        const ytSpy = vi.fn();
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={ytSpy} />);
        const input = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(input, { target: { value: 'https://youtu.be/Ypg8w7Dmq9o?si=6-QZYvd0_Qqrk0pJ' } });
        expect(ytSpy).toHaveBeenCalledWith({
            postUrl: 'https://youtu.be/Ypg8w7Dmq9o?si=6-QZYvd0_Qqrk0pJ',
            ogImageUrl: 'https://img.youtube.com/vi/Ypg8w7Dmq9o/maxresdefault.jpg',
            videoId: 'Ypg8w7Dmq9o',
        });
        // Twitter fetch は呼ばれない (YouTube に切替たため)
        expect(mockFetchTweet).not.toHaveBeenCalled();
    });

    it('detects YouTube URL (watch?v= 形式) and calls onYoutubeFetched', () => {
        const ytSpy = vi.fn();
        render(<HousingRegisterSnsUrlField onTweetFetched={() => {}} onYoutubeFetched={ytSpy} />);
        const input = screen.getByLabelText('housing.register.snsUrl.label');
        fireEvent.change(input, { target: { value: 'https://www.youtube.com/watch?v=Ypg8w7Dmq9o' } });
        expect(ytSpy).toHaveBeenCalledWith(
            expect.objectContaining({ videoId: 'Ypg8w7Dmq9o' }),
        );
    });

    // リグレッション: onTweetFetched の identity が毎レンダリングで変わっても (親の
    // fieldState 不安定が原因)、 同じ取得結果は親へ一度しか渡さない。
    // これが壊れると自動入力が再適用され、 ユーザーの編集 (区=17 等) が巻き戻る。
    it('同じ取得結果は再レンダリングしても親へ一度だけ渡す', () => {
        const data = { text: 'x', author: { name: 'a', screen_name: 'b' }, photos: [], video: false };
        tweetState = {
            status: 'success',
            data,
            errorCode: null,
            fetchTweet: mockFetchTweet,
            cancel: mockCancel,
            reset: mockReset,
        };
        const spy = vi.fn();
        function Wrapper() {
            const [, setN] = useState(0);
            return (
                <>
                    <button onClick={() => setN((n) => n + 1)}>rerender</button>
                    {/* 毎レンダリングで新しい関数 identity を渡す (不安定な onTweetFetched を再現) */}
                    <HousingRegisterSnsUrlField
                        onTweetFetched={(d, s) => spy(d, s)}
                        onYoutubeFetched={() => {}}
                    />
                </>
            );
        }
        render(<Wrapper />);
        expect(spy).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText('rerender'));
        fireEvent.click(screen.getByText('rerender'));
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
