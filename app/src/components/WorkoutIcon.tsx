import "./WorkoutIcon.css";

const HIGHLIGHT_CLASS = "workout-icon-highlight";
const BODY_CLASS = "workout-icon-body";
const BODY_STROKE_CLASS = "workout-icon-body-stroke";

type WorkoutIconProps = {
    workout: string;
    size?: "small" | "medium";
};

/**
 * Feature: Workout choices and monthly history use the same local anatomy icon system so muscle groups remain recognizable without image assets or network requests.
 * The silhouettes intentionally switch between front/back views depending on the muscle, which makes small Android icons much easier to read than generic fitness glyphs.
 */
export function WorkoutIcon({ workout, size = "medium" }: WorkoutIconProps) {
    if (workout === "Rest day") {
        // Feature: Recovery gets a calm moon/spark icon so a deliberate rest day cannot be confused with a missing workout entry.
        return <svg className={`workout-icon ${size}`} viewBox="0 0 64 64" aria-hidden="true">
            <path d="M43 49C28 52 16 41 18 27c1-8 6-15 14-18-3 11 2 22 12 27 4 2 8 3 13 2-3 5-8 9-14 11Z" className={HIGHLIGHT_CLASS}/>
            <path d="M46 11v8M42 15h8M52 24v6M49 27h6" className={BODY_STROKE_CLASS}/>
        </svg>;
    }

    if (workout === "Šetnja") {
        // Feature: Walking keeps a movement-specific icon instead of pretending it targets one isolated muscle group.
        return <svg className={`workout-icon ${size}`} viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="34" cy="10" r="6" className={BODY_CLASS}/>
            <path d="M31 18 24 34l10 7-6 17M31 20l11 11 11 2M34 41l12 17" className={BODY_STROKE_CLASS}/>
            <path d="M22 58h12M43 58h13" className={HIGHLIGHT_CLASS}/>
        </svg>;
    }

    const backView = workout === "Leđa" || workout === "Trapezius" || workout === "Triceps" || workout === "Gluteus";

    return <svg className={`workout-icon anatomy ${backView ? "back" : "front"} ${size}`} viewBox="0 0 64 64" aria-hidden="true">
        {/* Fix: A rounded anatomical silhouette replaces the old boxy torso so muscle highlights read as body regions rather than arbitrary shapes. */}
        <circle cx="32" cy="7.5" r="5.4" className={BODY_CLASS}/>
        <path d="M25 14c-3 1-6 3-8 6l-5 15c-.7 2 .3 4 2.2 4.8 1.8.7 3.8-.2 4.6-2l4.4-10.3 1.8 10.2-2.7 18.8h7l2.7-15.7 2.7 15.7h7L39 37.7l1.8-10.2 4.4 10.3c.8 1.8 2.8 2.7 4.6 2 1.9-.8 2.9-2.8 2.2-4.8l-5-15c-2-3-5-5-8-6-2 2-4.4 3-7 3s-5-1-7-3Z" className={BODY_CLASS}/>
        <path d="M25 15c1.5 3.5 4 5 7 5s5.5-1.5 7-5M32 20v17" className="workout-icon-anatomy-line"/>

        {workout === "Ramena" && <>
            <path d="M23 16.2c-3.7.8-6.5 3.2-7.4 6.2 2.2 1.4 4.7 1.6 7 .7 1.5-1.8 2.1-4.5.4-6.9Z" className={HIGHLIGHT_CLASS}/>
            <path d="M41 16.2c3.7.8 6.5 3.2 7.4 6.2-2.2 1.4-4.7 1.6-7 .7-1.5-1.8-2.1-4.5-.4-6.9Z" className={HIGHLIGHT_CLASS}/>
        </>}

        {workout === "Trapezius" && <path d="M25 14.8c2.1 2.3 4.4 3.5 7 3.5s4.9-1.2 7-3.5l3.5 5.8-5.1 4.2L32 21l-5.4 3.8-5.1-4.2 3.5-5.8Z" className={HIGHLIGHT_CLASS}/>} 

        {workout === "Grudi" && <>
            <path d="M24 20.2c2.3-1.3 5.5-.9 7.1 1.3v7.1c-3 .8-6.2.2-8.5-1.7-.6-2.5-.1-4.8 1.4-6.7Z" className={HIGHLIGHT_CLASS}/>
            <path d="M40 20.2c-2.3-1.3-5.5-.9-7.1 1.3v7.1c3 .8 6.2.2 8.5-1.7.6-2.5.1-4.8-1.4-6.7Z" className={HIGHLIGHT_CLASS}/>
        </>}

        {workout === "Leđa" && <>
            <path d="M24 20c2.4-1.7 5-2.5 8-2.5s5.6.8 8 2.5l-2.2 14.2-5.8 4.2-5.8-4.2L24 20Z" className={HIGHLIGHT_CLASS}/>
            <path d="M24.5 22.5 32 28l7.5-5.5M32 28v8" className="workout-icon-highlight-detail"/>
        </>}

        {workout === "Biceps" && <>
            <path d="M17.5 24.5c3.1-.7 5.1 1.2 4.4 4.4l-2.6 7c-.9 2.3-4.2 2.4-5.1.1-.5-1.3-.4-2.6.1-3.8l3.2-7.7Z" className={HIGHLIGHT_CLASS}/>
            <path d="M46.5 24.5c-3.1-.7-5.1 1.2-4.4 4.4l2.6 7c.9 2.3 4.2 2.4 5.1.1.5-1.3.4-2.6-.1-3.8l-3.2-7.7Z" className={HIGHLIGHT_CLASS}/>
        </>}

        {workout === "Triceps" && <>
            <path d="M18.8 23.8c2.2.2 3.8 1.8 3.5 4l-2.1 8.6c-.6 2.6-4.3 2.9-5.3.4-.5-1.1-.4-2.3 0-3.4l3.9-9.6Z" className={HIGHLIGHT_CLASS}/>
            <path d="M45.2 23.8c-2.2.2-3.8 1.8-3.5 4l2.1 8.6c.6 2.6 4.3 2.9 5.3.4.5-1.1.4-2.3 0-3.4l-3.9-9.6Z" className={HIGHLIGHT_CLASS}/>
        </>}

        {workout === "Podlaktica" && <>
            <path d="M14.7 34.4c1.9-.8 4-.1 4.8 1.8l-2.6 8.2c-.5 1.7-2.4 2.6-4 2-1.8-.7-2.6-2.7-1.8-4.4l3.6-7.6Z" className={HIGHLIGHT_CLASS}/>
            <path d="M49.3 34.4c-1.9-.8-4-.1-4.8 1.8l2.6 8.2c.5 1.7 2.4 2.6 4 2 1.8-.7 2.6-2.7 1.8-4.4l-3.6-7.6Z" className={HIGHLIGHT_CLASS}/>
        </>}

        {workout === "Stomak" && <>
            <path d="M27 29.5c1.4-.8 3.1-.8 4.5 0v5H27v-5ZM32.5 29.5c1.4-.8 3.1-.8 4.5 0v5h-4.5v-5ZM27 35.5h4.5v5.2c-1.5.6-3 .6-4.5-.1v-5.1ZM32.5 35.5H37v5.1c-1.5.7-3 .7-4.5.1v-5.2Z" className={HIGHLIGHT_CLASS}/>
            <path d="M32 29v12" className="workout-icon-highlight-detail"/>
        </>}

        {workout === "Noge" && <>
            <path d="M24.2 39.2h7l-2 16.9h-7.4l2.4-16.9Z" className={HIGHLIGHT_CLASS}/>
            <path d="M32.8 39.2h7l2.4 16.9h-7.4l-2-16.9Z" className={HIGHLIGHT_CLASS}/>
            <path d="M26.8 42.2 25 53M37.2 42.2 39 53" className="workout-icon-highlight-detail"/>
        </>}

        {workout === "Gluteus" && <>
            <path d="M24.2 36.5c1.7-2 5-2.2 7.5-.5v7c-3.3 1.3-6.7-.1-8.2-3.2-.5-1.1-.2-2.3.7-3.3Z" className={HIGHLIGHT_CLASS}/>
            <path d="M39.8 36.5c-1.7-2-5-2.2-7.5-.5v7c3.3 1.3 6.7-.1 8.2-3.2.5-1.1.2-2.3-.7-3.3Z" className={HIGHLIGHT_CLASS}/>
        </>}
    </svg>;
}
