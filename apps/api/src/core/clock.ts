export interface Clock {
    now(): Date;
}

export class SystemClock implements Clock {
    now(): Date {
        return new Date();
    }
}

export class FixedClock implements Clock {
    private current: Date;

    constructor(initial: Date) {
        this.current = initial;
    }

    now(): Date {
        return new Date(this.current.getTime());
    }

    advance(seconds: number): void {
        this.current = new Date(this.current.getTime() + seconds * 1000);
    }

    set(date: Date): void {
        this.current = new Date(date.getTime());
    }
}
