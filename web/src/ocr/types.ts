export type OcrProgress =
  | { stage: "loading"; message: string }
  | { stage: "detecting"; message: string }
  | { stage: "recognizing"; message: string; completed: number; total: number }
  | { stage: "done"; message: string };

export type OcrLog = {
  time: string;
  message: string;
};

export type OcrBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrLine = {
  text: string;
  score: number;
  box: OcrBox;
};

export type OcrResult = {
  lines: OcrLine[];
  elapsedMs: number;
  image: {
    width: number;
    height: number;
  };
};

export type WorkerRequest =
  | {
      type: "run";
      file: File;
    };

export type WorkerResponse =
  | {
      type: "progress";
      progress: OcrProgress;
    }
  | {
      type: "log";
      message: string;
    }
  | {
      type: "result";
      result: OcrResult;
    }
  | {
      type: "error";
      message: string;
    };
