import React from "react";

export function SliderField(props: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    hint?: string;
}) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-900">{props.label}</label>
                <span className="text-sm tabular-nums text-zinc-600">{props.value}</span>
            </div>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    className="flex-1 accent-zinc-900"
                    min={props.min}
                    max={props.max}
                    step={props.step}
                    value={props.value}
                    onChange={(e) => props.onChange(Number(e.target.value))}
                />
            </div>
            {props.hint ? <div className="mt-1.5 text-xs text-zinc-500">{props.hint}</div> : null}
        </div>
    );
}
