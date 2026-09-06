import { Centrifuge } from "centrifuge";
import { UserState } from "../../Auth/AuthReducer";

const createSocket = (user: UserState | null, url: string): Promise<Centrifuge> => {
    const startTime = performance.now();
    return new Promise<Centrifuge>((resolve, reject) => {
        if (!user?.refreshToken) {
            reject(new Error("Token tidak tersedia, tidak bisa connect ke Centrifugo"));
            return;
        }

        const centrifuge = new Centrifuge(url, {
            token: user.refreshToken,
        });

        centrifuge.on('connected', () => {
            resolve(centrifuge);
        });

        centrifuge.on('error', (ctx) => {
            reject(ctx);
        });

        centrifuge.connect();
    });
};

export default createSocket;