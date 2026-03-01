export interface Group {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateGroupDTO {
  name: string;
  memberIds: string[];
}
