export interface Plugin {
    id: string;
    name: string;
    version: string;
    file: File;
}

export interface Server {
    id: string;
    name: string;
    isActive: boolean;
}