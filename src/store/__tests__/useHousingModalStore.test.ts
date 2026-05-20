import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingModalStore } from '../useHousingModalStore';

describe('useHousingModalStore', () => {
    beforeEach(() => {
        // 各テスト前に store を初期化
        useHousingModalStore.setState({
            login: { open: false, fromRegister: false },
            account: { open: false },
            register: { open: false },
        });
    });

    it('initial state: all modals closed', () => {
        const s = useHousingModalStore.getState();
        expect(s.login.open).toBe(false);
        expect(s.account.open).toBe(false);
        expect(s.register.open).toBe(false);
    });

    it('openLogin sets login.open = true with fromRegister default false', () => {
        useHousingModalStore.getState().openLogin();
        const s = useHousingModalStore.getState();
        expect(s.login.open).toBe(true);
        expect(s.login.fromRegister).toBe(false);
    });

    it('openLogin({ fromRegister: true }) sets fromRegister flag', () => {
        useHousingModalStore.getState().openLogin({ fromRegister: true });
        expect(useHousingModalStore.getState().login.fromRegister).toBe(true);
    });

    it('closeLogin when fromRegister=false only closes login', () => {
        useHousingModalStore.setState({
            login: { open: true, fromRegister: false },
            register: { open: true },
            account: { open: false },
        });
        useHousingModalStore.getState().closeLogin();
        const s = useHousingModalStore.getState();
        expect(s.login.open).toBe(false);
        expect(s.register.open).toBe(true);  // register stays open
    });

    it('closeLogin when fromRegister=true also closes register', () => {
        useHousingModalStore.setState({
            login: { open: true, fromRegister: true },
            register: { open: true },
            account: { open: false },
        });
        useHousingModalStore.getState().closeLogin();
        const s = useHousingModalStore.getState();
        expect(s.login.open).toBe(false);
        expect(s.register.open).toBe(false);
        expect(s.login.fromRegister).toBe(false);  // reset
    });

    it('openAccount sets account.open = true', () => {
        useHousingModalStore.getState().openAccount();
        expect(useHousingModalStore.getState().account.open).toBe(true);
    });

    it('closeAccount sets account.open = false', () => {
        useHousingModalStore.setState({
            login: { open: false, fromRegister: false },
            account: { open: true },
            register: { open: false },
        });
        useHousingModalStore.getState().closeAccount();
        expect(useHousingModalStore.getState().account.open).toBe(false);
    });

    it('openRegister sets register.open = true', () => {
        useHousingModalStore.getState().openRegister();
        expect(useHousingModalStore.getState().register.open).toBe(true);
    });

    it('closeRegister sets register.open = false', () => {
        useHousingModalStore.setState({
            login: { open: false, fromRegister: false },
            account: { open: false },
            register: { open: true },
        });
        useHousingModalStore.getState().closeRegister();
        expect(useHousingModalStore.getState().register.open).toBe(false);
    });

    it('syncFromUrl reads ?register=open and opens register', () => {
        const params = new URLSearchParams('?register=open');
        useHousingModalStore.getState().syncFromUrl(params);
        expect(useHousingModalStore.getState().register.open).toBe(true);
    });

    it('syncFromUrl with no register param closes register', () => {
        useHousingModalStore.setState({
            login: { open: false, fromRegister: false },
            account: { open: false },
            register: { open: true },
        });
        const params = new URLSearchParams('');
        useHousingModalStore.getState().syncFromUrl(params);
        expect(useHousingModalStore.getState().register.open).toBe(false);
    });
});
