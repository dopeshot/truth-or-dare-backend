import { Injectable, InternalServerErrorException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetTasksDto } from './dto/update-set-tasks.dto';
import { Set, SetDocument } from './entities/set.entity';
import { Model, ObjectId, Types } from 'mongoose';
import { SetStatus } from './enums/setstatus.enum';
import { UpdateSetDto } from './dto/update-set-metadata.dto';
import { Task, TaskContent, TaskDocument, TaskSchema, TaskContentSchema } from '../task/entities/task.entity';
import { TaskService } from 'src/task/task.service';

@Injectable()
export class SetService {
  constructor(@InjectModel('Set') private setSchema: Model<SetDocument>,
    @InjectModel('Task') private taskSchema: Model<TaskDocument>) { }

  async create(metaData: CreateSetDto, user: any): Promise<SetDocument> {
    try {
      const set = new this.setSchema({
        ...metaData,
        creator: user.userId
      })
      const result = await set.save()

      return result
    } catch (error) {
      console.log(error)
      throw new InternalServerErrorException()
    }
  }

  async alterTasks(id: ObjectId, mode: string, Tasks: UpdateSetTasksDto) {
    let set = await this.setSchema.findById(id)
    if (!set) { throw new NotFoundException() }

    for (let task of Tasks.tasks) {
      if (mode === "add") {
        //Check if element is not already in array
        if (set.taskList.indexOf(task) == -1) {
          set.taskList.push(task)
          if (await (await this.taskSchema.findById(task)).type == "truth") { set.truthCount++ }
          else { set.daresCount++ }
        }
      } else {
        //Check if element exists and therefore can be deleted
        const index = set.taskList.indexOf(task)
        if (index != -1) {
          set.taskList.splice(index, 1)
          if (await (await this.taskSchema.findById(task)).type == "truth") { set.truthCount-- }
          else { set.daresCount-- }
        }
      }
    }

    const result = await set.save()

    return result;
  }

  async findAll(): Promise<SetDocument[]> {
    return await this.setSchema.find()
  }

  async findOne(id: ObjectId) {
    let set = await this.setSchema.findById(id).lean()
    if (!set)
      throw new NotFoundException()
    return set;
  }
  async userSets(id: ObjectId, page: number, limit: number) {
    let userSets = await this.setSchema.aggregate([
      {
        '$match': {
          'creator': Types.ObjectId(id.toString())
        }
      }, {
        $skip: page * limit
      }, {
        $limit: limit
      }
    ])
    return userSets
  }

  async updateMetadata(id: ObjectId, updateSetDto: UpdateSetDto) {

    // Find Object
    let set = await this.setSchema.findById(id)

    if (!set) { throw new NotFoundException() }


    try {
      if (updateSetDto.hasOwnProperty("description")) { set.description = updateSetDto.description }
      if (updateSetDto.hasOwnProperty("name")) { set.name = updateSetDto.name }

    } catch (error) { throw new UnprocessableEntityException }
    const result = await set.save()

    return result;
  }

  // Up- Downvotes a Task
  async vote(id: ObjectId, vote: string): Promise<SetDocument> {
    // Find Object
    let set = await this.setSchema.findById(id)
    if (!set) { throw new NotFoundException() }

    // Query check
    const isUpvote = vote && vote === 'upvote'
    const isDownvote = vote && vote === 'downvote'

    // Handle vote
    if (isUpvote) {
      set.likes += 1;
      set.difference++
    }

    if (isDownvote) {
      set.dislikes += 1;
      set.difference--
    }

    return await set.save()
  }

  async remove(id: ObjectId, type: string): Promise<void> {
    // Check query
    const isHardDelete = type ? type.includes('hard') : false

    // true is for admin check later
    if (true && isHardDelete) {
      // Check if there is a set with this id and remove it
      const set = await this.setSchema.findByIdAndDelete(id)
      if (!set)
        throw new NotFoundException()

      // We have to return here to exit process
      return
    }

    // Soft delete
    const set = await this.setSchema.findByIdAndUpdate(id, {
      status: SetStatus.DELETED
    }, {
      new: true
    })
    if (!set)
      throw new NotFoundException()
  }

  async getTasks(id: ObjectId, page: number) {

    const isPaged = page ? true : false
    //console.time()
    const set = await this.setSchema.findById(id)

    if (!set) {
      throw new NotFoundException()
    }

    let taskList: TaskDocument[] = []

    let list = set.taskList

    if (isPaged) {
      if (list.length > +process.env.SET_PAGE_LENGTH * (page)) {
        list = list.slice(+process.env.SET_PAGE_LENGTH * (page))
      }
    }

    for (const taskId of list) {
      let task = await this.taskSchema.findById(taskId)
      if (task) {
        taskList.push(task)
      }

      // break if page length is reached
      if (isPaged && taskList.length === +process.env.SET_PAGE_LENGTH) {
        break
      }

    }
    //console.timeEnd()
    return taskList
  }

  async getTasks2(id: ObjectId, page: number, limit: number): Promise<Set> {
    const skip = page * limit
    limit += skip
    const idd = id.toString()
    const set: Set = await this.setSchema.findById(id).populate('taskList')
    //console.time()
    /*const result = await this.setSchema.aggregate([
      { '$match': { '_id': Types.ObjectId(idd) } },
      {
        '$lookup': {
          'from': 'tasks',
          'localField': 'taskList',
          'foreignField': '_id',
          'pipeline': [
            {
              '$sort': {
                'difference': -1, '_id': 1
              }
            }, {
              '$skip': skip
            }, {
              '$limit': limit
            }
          ],
          'as': 'objects'
        }
      }, {
        '$project': {
          'objects': 1
        }
      }
    ])*/

    //console.timeEnd()
    //if (result.length == 0) { throw new NotFoundException }
    return set
  }

  async findTopTenTasks(id: ObjectId): Promise<TaskDocument[]> {
    const idd = id.toString()
    const result = await this.setSchema.aggregate([
      { '$match': { '_id': Types.ObjectId(idd) } },
      {
        '$lookup': {
          'from': 'tasks',
          'localField': 'taskList',
          'foreignField': '_id',
          'pipeline': [
            {
              '$sort': {
                'difference': -1, '_id': 1
              }
            }, {
              '$limit': 10
            }
          ],
          'as': 'objects'
        }
      }, {
        '$project': {
          'objects': 1
        }
      }
    ])
    if (!result) { throw new NotFoundException }
    return result
  }

  async getMetadata(id: ObjectId) {
    const set = await this.setSchema.findById(id)

    if (!set)
      throw new NotFoundException()

    return {
      "description": set.description,
      "name": set.name
    }
  }

  async healthCheck() {
  if(true){  
    let taskIdsInSets = []
    // Get all referenced task ids
    const result = await this.setSchema.aggregate([
      {
        '$project': {
          'taskList': 1
        }
      }
    ])

    // Map all elements in one row
    result.forEach(set => taskIdsInSets.push(...set.taskList.map(x=> x.toString())))

    // Delete duplicates of taskIds here
    taskIdsInSets.filter((item, index) => taskIdsInSets.indexOf(item) != index)

    // Get the existing task ids that are referenced in a Set
    const result2 = await this.taskSchema.aggregate([
      {
        '$match': {
          '_id': {
            '$in': [...taskIdsInSets.map(x => Types.ObjectId(x.toString()))]
          }
        }
      }, {
        '$project': {
          '_id': 1
        }
      }
    ])

    let existingIdsInTasks = []
    // Getting ids from result2 Object into
    result2.forEach(set => existingIdsInTasks.push(set._id.toString()))

    // Filtering out the ids that don't actually exist
    let nonExistingTaskIds = taskIdsInSets.filter(x => existingIdsInTasks.indexOf(x) === -1);

    // Deleting the ids that don't actually exist but are in Sets
    const finalResult = await this.setSchema.updateMany(
      {
        $pullAll: {
          taskList: [...nonExistingTaskIds.map(x => Types.ObjectId(x.toString()))]
        }
      })
    console.log(finalResult)
    return finalResult
}  
const result = await this.setSchema.aggregate(
[
  {
    '$lookup': {
      'from': 'tasks', 
      'let': {
        'taskList': '$taskList'
      }, 
      'pipeline': [
        {
          '$match': {
            '$expr': {
              '$in': [
                '$_id', '$$taskList'
              ]
            }
          }
        }
      ], 
      'as': 'valid'
    }
  }, {
    '$addFields': {
      'valid': {
        '$map': {
          'input': '$valid', 
          'as': 'v', 
          'in': '$$v._id'
        }
      }
    }
  }, {
    '$addFields': {
      'taskList': {
        '$filter': {
          'input': '$taskList', 
          'as': 't', 
          'cond': {
            '$in': [
              '$$t', '$valid'
            ]
          }
        }
      }
    }
  }, {
    '$unset': [
      'valid'
    ]
  }
]
)

    return result
  }
}

/*
How does $function and $where work to use functions in the query
How to use operators in aggregation

SetDifference:
aggregate([
  {
    $group: {
      _id: "null",
      ids: {
        "$addToSet": "$_id"
      }
    }
  },
  {
    $project: {
      nonMatchingTaskIds: {
        $setDifference: [
          [
            "taskId1",
            "taskId2",
            "taskId7",
            "taskId8"
          ],
          "$ids"
        ]
      }
    }
  }
])
*/
