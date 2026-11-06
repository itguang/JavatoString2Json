import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseJavaToString } from '../src/parser/parseJavaToString.js'

function parse (input, options) {
  return parseJavaToString(input, options).value
}

test('单元素 List 展开为对象（原注释中的示例）', () => {
  const input = '[Request(vehicle=VehicleRequest(vehicleId=VE-INFLFIOWQX6, brand=Y - 英菲尼迪, displacement=2.5T-混合动力, productionYear=2017,  tid=115331, avgPrice=0.0, distance=0, onRoadTime=2017-6, properties=[], carId=), channel=Android)]'
  assert.deepEqual(parse(input), {
    vehicle: {
      vehicleId: 'VE-INFLFIOWQX6',
      brand: 'Y - 英菲尼迪',
      displacement: '2.5T-混合动力',
      productionYear: '2017',
      tid: '115331',
      avgPrice: '0.0',
      distance: '0',
      onRoadTime: '2017-6',
      properties: [],
      carId: ''
    },
    channel: 'Android'
  })
})

test('多元素 List 保留为数组', () => {
  assert.deepEqual(parse('[Item(a=1), Item(a=2)]'), [{ a: '1' }, { a: '2' }])
  assert.deepEqual(parse('[1, 2, 3]'), ['1', '2', '3'])
})

test('IDE 生成的花括号格式与引号字符串', () => {
  const input = 'User{id=123, name="张三", age=25, address=Address{city="北京", district=\'朝阳区\'}}'
  assert.deepEqual(parse(input), {
    id: '123',
    name: '张三',
    age: '25',
    address: { city: '北京', district: '朝阳区' }
  })
})

test('嵌套数组中的对象', () => {
  const input = 'Order{id=ORD001, items=[Item{name="商品A", price=100}, Item{name="商品B", price=200}]}'
  assert.deepEqual(parse(input), {
    id: 'ORD001',
    items: [{ name: '商品A', price: '100' }, { name: '商品B', price: '200' }]
  })
})

test('裸字段列表', () => {
  assert.deepEqual(parse('id=123, name="test", active=true, score=98.5'), {
    id: '123', name: 'test', active: true, score: '98.5'
  })
})

test('super 字段：对象展开，hash 丢弃', () => {
  assert.deepEqual(parse('Child(super=Parent(id=1, name=p), age=3)'), { id: '1', name: 'p', age: '3' })
  assert.deepEqual(parse('Child(super=com.demo.Parent@1a2b3c, age=3)'), { age: '3' })
})

test('ClassName@hash 保留原字符串', () => {
  assert.deepEqual(parse('A(owner=com.demo.Owner@6d06d69c)'), { owner: 'com.demo.Owner@6d06d69c' })
})

test('邮箱不会被当成 ClassName@hash 截断', () => {
  assert.deepEqual(parse('A(email=abc@x.com, b=1)'), { email: 'abc@x.com', b: '1' })
})

test('null / true / false / Map / 空对象', () => {
  assert.deepEqual(parse('A(a=null, b=true, c=false, m={k1=v1, k2=v2}, e=Empty())'), {
    a: null, b: true, c: false, m: { k1: 'v1', k2: 'v2' }, e: {}
  })
})

test('值里的逗号和括号不会被错误拆分', () => {
  assert.deepEqual(parse('A(remark=a, b, c, desc=foo(bar), x=1)'), {
    remark: 'a, b, c', desc: 'foo(bar)', x: '1'
  })
})

test('引号字符串内部含引号', () => {
  assert.deepEqual(parse("A(name='O'Brien', b=1)"), { name: "O'Brien", b: '1' })
})

test('括号不匹配时能结束并给出 warning（死循环回归）', () => {
  const { value, warnings } = parseJavaToString('X(list=[a), b])')
  assert.deepEqual(value, { list: ['a', 'b'] })
  assert.equal(warnings.length, 1)
  assert.equal(warnings[0].offset, 9)
  assert.equal(warnings[0].line, 1)
  assert.equal(warnings[0].column, 10)
})

test('缺少右括号与尾部多余内容都会给出 warning', () => {
  assert.equal(parseJavaToString('A(b=B(c=1)').warnings.length, 1)
  const trailing = parseJavaToString('A(b=1) trailing')
  assert.deepEqual(trailing.value, { b: '1' })
  assert.equal(trailing.warnings.length, 1)
})

test('Java Date 中的 CST 按中国时区转换', () => {
  assert.deepEqual(parse('A(t=Mon Jan 01 10:00:00 CST 2024)'), { t: Date.parse('2024-01-01T02:00:00Z') })
  assert.deepEqual(parse('A(t=Mon Jan 01 10:00:00 CST 2024)', { convertDates: false }), { t: 'Mon Jan 01 10:00:00 CST 2024' })
})

test('convertNumbers 只转换安全范围内的数字', () => {
  assert.deepEqual(parse('A(a=0.0, b=-12, c=12345678901234567890, d=007, e=1.5x)', { convertNumbers: true }), {
    a: 0, b: -12, c: '12345678901234567890', d: '007', e: '1.5x'
  })
})

test('空输入抛出错误', () => {
  assert.throws(() => parseJavaToString('   '), /请输入有效的/)
})

test('2MB 输入在 1 秒内完成', () => {
  const items = Array.from({ length: 20000 }, (_, i) =>
    `Item(id=${i}, name=商品${i}, tags=[a, b, c], sub=Sub(x=${i}, createTime=Mon Jan 01 10:00:00 CST 2024))`)
  const input = '[' + items.join(', ') + ']'
  assert.ok(input.length > 2_000_000)

  const startedAt = performance.now()
  const { value, warnings } = parseJavaToString(input)
  const elapsedMs = performance.now() - startedAt

  assert.equal(value.length, 20000)
  assert.equal(warnings.length, 0)
  assert.ok(elapsedMs < 1000, `耗时 ${elapsedMs}ms`)
})
